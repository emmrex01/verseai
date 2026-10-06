import type { SourceBlock } from "./structure";

export const SUPPORTED_EXTENSIONS = ["docx", "pdf", "txt", "md"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Serverless request bodies are capped (~4.5 MB on Vercel). A novel as DOCX is typically < 1 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export class ManuscriptParseError extends Error {}

export function extensionOf(filename: string): SupportedExtension | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as SupportedExtension) : null;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…",
};

export function decodeHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Mammoth HTML -> blocks, keeping heading levels from Word styles. */
export function blocksFromHtml(html: string): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const re = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[1].toLowerCase();
    const text = decodeHtml(m[2]).trim();
    if (!text) continue;
    blocks.push(tag.startsWith("h") ? { text, heading: Number(tag[1]) } : { text });
  }
  return blocks;
}

/** Plain text / Markdown: paragraphs are separated by blank lines. */
export function blocksFromText(text: string): SourceBlock[] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const hasBlankLines = /\n\s*\n/.test(normalized);
  const parts = hasBlankLines ? normalized.split(/\n\s*\n/) : normalized.split("\n");
  return parts
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((text) => {
      const md = text.match(/^(#{1,6})\s+(.*)$/);
      return md ? { text: md[2], heading: md[1].length } : { text };
    });
}

/**
 * PDF text arrives as hard-wrapped lines. Rejoin lines into paragraphs:
 * a paragraph ends at a blank line, or at a line that ends a sentence and is
 * noticeably shorter than a full line.
 */
export function blocksFromPdfPages(pages: string[]): SourceBlock[] {
  const lines = pages.flatMap((p) => p.replace(/\r\n?/g, "\n").split("\n").concat([""]));
  const lengths = lines.map((l) => l.trim().length).filter((n) => n > 0).sort((a, b) => a - b);
  const fullLine = lengths.length ? lengths[Math.floor(lengths.length * 0.8)] : 80;

  const blocks: SourceBlock[] = [];
  let current: string[] = [];
  const push = () => {
    const text = current.join(" ").replace(/(\w)- (\w)/g, "$1$2").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ text });
    current = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      push();
      continue;
    }
    current.push(line);
    const endsSentence = /[.!?…:"”’)]$/.test(line);
    if (endsSentence && line.length < fullLine * 0.85) push();
  }
  push();
  return blocks;
}

export async function parseManuscript(buffer: Buffer, filename: string): Promise<SourceBlock[]> {
  const ext = extensionOf(filename);
  if (!ext) throw new ManuscriptParseError("Unsupported file type. Upload a .docx, .pdf, .txt or .md file.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new ManuscriptParseError("File is larger than 4 MB. Save it as .docx (without embedded images) and try again.");

  let blocks: SourceBlock[];
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer });
    blocks = blocksFromHtml(value);
  } else if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    blocks = blocksFromPdfPages(Array.isArray(text) ? text : [text]);
  } else {
    blocks = blocksFromText(buffer.toString("utf8"));
  }

  if (blocks.length === 0) {
    throw new ManuscriptParseError(
      ext === "pdf"
        ? "We couldn't find any text in this PDF. Scanned PDFs aren't supported yet — export a DOCX or text-based PDF instead."
        : "We couldn't find any text in this file.",
    );
  }
  return blocks;
}
