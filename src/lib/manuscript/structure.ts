import { createHash } from "node:crypto";

/** A block of text as it came out of the source document. */
export interface SourceBlock {
  text: string;
  /** Heading level (1-6) when the source marked it as a heading, e.g. DOCX styles. */
  heading?: number;
}

export interface StructuredParagraph {
  text: string;
  sceneIdx: number;
}

export interface StructuredChapter {
  title: string;
  paragraphs: StructuredParagraph[];
  wordCount: number;
  sceneCount: number;
  contentHash: string;
}

export interface StructuredManuscript {
  chapters: StructuredChapter[];
  wordCount: number;
  /** false when no chapter headings were found and the text was split into sections. */
  chaptersDetected: boolean;
}

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";

const CHAPTER_RE = new RegExp(
  String.raw`^(chapter|ch\.)\s+([0-9]{1,3}|[ivxlc]{1,7}|(?:(?:${NUMBER_WORDS})[\s-]*)+)\b`,
  "i",
);
const NAMED_SECTION_RE =
  /^(prologue|epilogue|interlude|introduction|preface|foreword|afterword|conclusion)\b/i;
const PART_RE = new RegExp(String.raw`^(part|book)\s+([0-9]{1,2}|[ivxlc]{1,6}|${NUMBER_WORDS})\b`, "i");
const BARE_NUMBER_RE = /^(\d{1,3}|[IVXLC]{1,7})\.?$/;
const MARKDOWN_HEADING_RE = /^#{1,2}\s+\S/;
const SCENE_BREAK_RE = /^\s*(?:(?:[*#~•◆❖§]\s*){1,5}|-{3,}|_{3,}|={3,})\s*$/;

const SECTION_WORDS = 3000;
const MIN_FRONT_MATTER_WORDS = 150;

export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hashParagraphs(paragraphs: StructuredParagraph[]): string {
  const h = createHash("sha256");
  for (const p of paragraphs) h.update(normalizeWhitespace(p.text) + "\n");
  return h.digest("hex");
}

export function isSceneBreak(text: string): boolean {
  return SCENE_BREAK_RE.test(text);
}

/** Heuristic chapter-heading test for plain text (no style information). */
export function looksLikeChapterHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 90) return false;
  if (MARKDOWN_HEADING_RE.test(t)) return true;
  if (CHAPTER_RE.test(t) || NAMED_SECTION_RE.test(t) || PART_RE.test(t)) {
    // "Chapter 3 was the hardest to write." is prose, not a heading.
    return !/[.!?]["”’]?$/.test(t) || t.split(/\s+/).length <= 6;
  }
  return BARE_NUMBER_RE.test(t);
}

function cleanHeading(text: string): string {
  return normalizeWhitespace(text.replace(/^#{1,6}\s+/, ""));
}

function finalizeChapter(title: string, paragraphs: StructuredParagraph[]): StructuredChapter {
  // Re-number scenes so they start at 0 and have no gaps.
  const sceneMap = new Map<number, number>();
  for (const p of paragraphs) {
    if (!sceneMap.has(p.sceneIdx)) sceneMap.set(p.sceneIdx, sceneMap.size);
    p.sceneIdx = sceneMap.get(p.sceneIdx)!;
  }
  return {
    title,
    paragraphs,
    wordCount: paragraphs.reduce((n, p) => n + countWords(p.text), 0),
    sceneCount: Math.max(1, sceneMap.size),
    contentHash: hashParagraphs(paragraphs),
  };
}

/** Pick which blocks are chapter headings. Prefers explicit document headings. */
function headingIndexes(blocks: SourceBlock[]): Set<number> {
  const styled = new Map<number, number[]>();
  blocks.forEach((b, i) => {
    if (b.heading && b.heading <= 2 && b.text.trim()) {
      styled.set(b.heading, [...(styled.get(b.heading) ?? []), i]);
    }
  });
  // Use the heading level that splits the book into the most chapters.
  let best: number[] = [];
  for (const idxs of styled.values()) if (idxs.length > best.length) best = idxs;
  if (best.length >= 2) {
    // Include other heading levels that look like chapters (e.g. "Prologue" styled as h1 while chapters are h2).
    const extra = [...styled.values()].flat().filter((i) => looksLikeChapterHeading(blocks[i].text));
    return new Set([...best, ...extra]);
  }

  const heuristic = new Set<number>();
  blocks.forEach((b, i) => {
    if (looksLikeChapterHeading(b.text)) heuristic.add(i);
  });
  // A single "1" in a list is noise; require at least two headings.
  return heuristic.size >= 2 ? heuristic : new Set();
}

function splitIntoSections(paragraphs: StructuredParagraph[]): StructuredChapter[] {
  const chapters: StructuredChapter[] = [];
  let current: StructuredParagraph[] = [];
  let words = 0;
  for (const p of paragraphs) {
    current.push(p);
    words += countWords(p.text);
    if (words >= SECTION_WORDS) {
      chapters.push(finalizeChapter(`Section ${chapters.length + 1}`, current));
      current = [];
      words = 0;
    }
  }
  if (current.length) chapters.push(finalizeChapter(`Section ${chapters.length + 1}`, current));
  return chapters;
}

/**
 * Turn a flat list of blocks into chapters -> scenes -> paragraphs.
 * Headings that immediately follow another heading (e.g. "Part One" then
 * "Chapter 1") are merged into one title instead of creating empty chapters.
 */
export function structureManuscript(blocks: SourceBlock[]): StructuredManuscript {
  const cleaned = blocks
    .map((b) => ({ ...b, text: b.text.replace(/ /g, " ").trim() }))
    .filter((b) => b.text.length > 0)
    // Drop page numbers that survive PDF extraction.
    .filter((b) => !/^(page\s+)?\d{1,4}$/i.test(b.text) || looksLikeChapterHeading(b.text));

  const headings = headingIndexes(cleaned);

  if (headings.size === 0) {
    const paragraphs: StructuredParagraph[] = [];
    let scene = 0;
    for (const b of cleaned) {
      if (isSceneBreak(b.text)) {
        scene++;
        continue;
      }
      paragraphs.push({ text: b.text, sceneIdx: scene });
    }
    const chapters = splitIntoSections(paragraphs);
    return { chapters, wordCount: sum(chapters), chaptersDetected: false };
  }

  const chapters: StructuredChapter[] = [];
  let title: string | null = null;
  let pendingTitles: string[] = [];
  let paragraphs: StructuredParagraph[] = [];
  let scene = 0;
  const frontMatter: StructuredParagraph[] = [];

  const flush = () => {
    if (title !== null && paragraphs.length > 0) chapters.push(finalizeChapter(title, paragraphs));
  };

  for (let i = 0; i < cleaned.length; i++) {
    const b = cleaned[i];
    if (headings.has(i)) {
      if (paragraphs.length === 0 && title !== null) {
        pendingTitles.push(cleanHeading(b.text));
        title = pendingTitles.join(" — ");
        continue;
      }
      flush();
      pendingTitles = [cleanHeading(b.text)];
      title = pendingTitles[0];
      paragraphs = [];
      scene = 0;
      continue;
    }
    if (isSceneBreak(b.text)) {
      if (paragraphs.length) scene++;
      continue;
    }
    if (title === null) frontMatter.push({ text: b.text, sceneIdx: 0 });
    else paragraphs.push({ text: b.text, sceneIdx: scene });
  }
  flush();

  const frontWords = frontMatter.reduce((n, p) => n + countWords(p.text), 0);
  if (frontWords >= MIN_FRONT_MATTER_WORDS) chapters.unshift(finalizeChapter("Opening", frontMatter));

  return { chapters, wordCount: sum(chapters), chaptersDetected: true };
}

function sum(chapters: StructuredChapter[]): number {
  return chapters.reduce((n, c) => n + c.wordCount, 0);
}
