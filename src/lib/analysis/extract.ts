import { z } from "zod";
import { addUsage, callStructured, emptyUsage, type Usage } from "@/lib/ai/client";
import { locateQuote } from "./evidence";

/** Bump when prompts/schemas change so cached chapter extractions are rebuilt. */
export const PIPELINE_VERSION = 1;

/** Chapters longer than this are extracted in parts so nothing gets skimmed. */
const MAX_WORDS_PER_CALL = 9000;

export const FACT_CATEGORIES = [
  "age", "appearance", "background", "family", "relationship", "personality",
  "goal", "fear", "knowledge", "location", "possession", "status", "skill", "other",
] as const;

const ExtractionSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of what happens in this passage."),
  entities: z.array(
    z.object({
      name: z.string().describe("Fullest name used in this passage."),
      type: z.enum(["character", "location", "object", "organization"]).catch("object"),
      aliases: z.array(z.string()).describe("Other names, nicknames or titles used for the same entity in this passage."),
      descriptor: z.string().describe("Short description grounded in this passage."),
    }),
  ),
  facts: z.array(
    z.object({
      entity: z.string().describe("Entity name exactly as in `entities`."),
      category: z.enum(FACT_CATEGORIES).catch("other"),
      statement: z.string().describe("One concrete, checkable claim the text makes, e.g. 'Sarah is 34' or 'Sarah has never visited Paris'."),
      paragraph: z.number().int().describe("The [P#] number containing the quote."),
      quote: z.string().describe("Verbatim words copied from that paragraph (5-30 words) that support the statement."),
    }),
  ),
  relationships: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      kind: z.string().describe("e.g. sibling, parent, spouse, romantic tension, rival, mentor, employer, friend"),
      description: z.string(),
      paragraph: z.number().int(),
      quote: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      summary: z.string(),
      time_marker: z.string().nullable().describe("Any stated or implied time: a date, 'three days later', 'that night', a character's age. null if none."),
      significance: z.enum(["major", "minor"]).catch("minor"),
      participants: z.array(z.string()),
      paragraph: z.number().int(),
      quote: z.string(),
    }),
  ),
  threads: z.array(
    z.object({
      status: z.enum(["opened", "advanced", "resolved"]).catch("advanced"),
      thread: z.string().describe("A story question, mystery, promise or setup, phrased the same way each time it recurs, e.g. 'Who sent the letter?'"),
      paragraph: z.number().int(),
      quote: z.string(),
    }),
  ),
  pacing: z.object({
    tension: z.number().int().describe("1-10: how much is at stake and unresolved in this passage."),
    conflict: z.number().int().describe("1-10: active opposition, argument, danger or struggle."),
    emotional_shift: z.number().int().describe("1-10: how much characters' emotional state changes."),
    turning_point: z.boolean().describe("Does something happen that changes the direction of the story?"),
  }),
});

export type RawExtraction = z.infer<typeof ExtractionSchema>;

export interface Cited {
  paragraph: number;
  quote: string;
}

/** Extraction after evidence verification; every citation is real. */
export interface ChapterExtraction {
  summary: string;
  entities: RawExtraction["entities"];
  facts: (RawExtraction["facts"][number] & Cited)[];
  relationships: (RawExtraction["relationships"][number] & Cited)[];
  events: (RawExtraction["events"][number] & Cited)[];
  threads: (RawExtraction["threads"][number] & Cited)[];
  pacing: RawExtraction["pacing"];
  dropped: number;
}

export interface BookContext {
  title: string;
  genre?: string | null;
  kind: "fiction" | "nonfiction";
}

const SYSTEM = `You are the extraction stage of Verse, an editorial tool that builds a Story Bible from an author's manuscript.

You read one passage at a time. Paragraphs are labelled [P#]. Record what THIS passage states — never invent, infer beyond the text, or use outside knowledge of other books.

Rules:
- Every fact, relationship, event and thread must cite the [P#] number and copy a short verbatim quote (5-30 words) from that paragraph. Copy the words exactly, including punctuation. If you cannot quote it, leave it out.
- Facts are concrete and checkable: ages, dates, physical traits, family ties, places lived or visited, possessions, skills, what a character knows, and explicit statements like "I have never…". Prefer facts that could later conflict with something else in the book. Skip vague mood descriptions.
- Record what the text asserts, attributed honestly: if a character claims something, the statement is "Sarah says she has never visited Paris", not "Sarah has never visited Paris".
- Use the fullest name for each entity and list nicknames as aliases. Do not create entities for pronouns or unnamed people unless they are recurring (e.g. "the stranger").
- For non-fiction, characters are real people discussed; threads are the book's open questions and promised explanations.
- Threads: record setups and story questions when they are raised (opened), when they move forward (advanced), and when they are answered (resolved). Use consistent wording for the same thread.
- Pacing scores are relative to a typical chapter in this genre.`;

function renderPassage(paragraphs: string[], start: number, end: number): string {
  const lines: string[] = [];
  for (let i = start; i < end; i++) lines.push(`[P${i}] ${paragraphs[i]}`);
  return lines.join("\n\n");
}

function partsFor(paragraphs: string[]): [number, number][] {
  const parts: [number, number][] = [];
  let start = 0;
  let words = 0;
  paragraphs.forEach((p, i) => {
    words += p.split(/\s+/).length;
    if (words >= MAX_WORDS_PER_CALL && i < paragraphs.length - 1) {
      parts.push([start, i + 1]);
      start = i + 1;
      words = 0;
    }
  });
  parts.push([start, paragraphs.length]);
  return parts;
}

function verify<T extends Cited>(items: T[], paragraphs: string[]): { kept: T[]; dropped: number } {
  const kept: T[] = [];
  let dropped = 0;
  for (const item of items) {
    const at = locateQuote(paragraphs, item.paragraph, item.quote);
    if (at === null) dropped++;
    else kept.push({ ...item, paragraph: at });
  }
  return { kept, dropped };
}

export async function extractChapter(
  book: BookContext,
  chapter: { idx: number; title: string; paragraphs: string[] },
): Promise<{ extraction: ChapterExtraction; usage: Usage }> {
  let usage = emptyUsage();
  const raws: RawExtraction[] = [];

  for (const [start, end] of partsFor(chapter.paragraphs)) {
    const header = `Book: "${book.title}"${book.genre ? ` (${book.genre})` : ""} — ${book.kind}\nChapter ${chapter.idx + 1}: ${chapter.title}${
      start > 0 ? ` (continued from [P${start - 1}])` : ""
    }`;
    const { data, usage: u } = await callStructured({
      tier: "fast",
      system: SYSTEM,
      user: `${header}\n\n<passage>\n${renderPassage(chapter.paragraphs, start, end)}\n</passage>`,
      schema: ExtractionSchema,
      maxTokens: 16000,
    });
    raws.push(data);
    usage = addUsage(usage, u);
  }

  const merged: RawExtraction = {
    summary: raws.map((r) => r.summary).join(" "),
    entities: raws.flatMap((r) => r.entities),
    facts: raws.flatMap((r) => r.facts),
    relationships: raws.flatMap((r) => r.relationships),
    events: raws.flatMap((r) => r.events),
    threads: raws.flatMap((r) => r.threads),
    pacing: averagePacing(raws.map((r) => r.pacing)),
  };

  const facts = verify(merged.facts, chapter.paragraphs);
  const relationships = verify(merged.relationships, chapter.paragraphs);
  const events = verify(merged.events, chapter.paragraphs);
  const threads = verify(merged.threads, chapter.paragraphs);

  return {
    extraction: {
      summary: merged.summary,
      entities: merged.entities,
      facts: facts.kept,
      relationships: relationships.kept,
      events: events.kept,
      threads: threads.kept,
      pacing: merged.pacing,
      dropped: facts.dropped + relationships.dropped + events.dropped + threads.dropped,
    },
    usage,
  };
}

function clamp(n: number) {
  return Math.min(10, Math.max(1, Math.round(n)));
}

function averagePacing(items: RawExtraction["pacing"][]): RawExtraction["pacing"] {
  const avg = (k: "tension" | "conflict" | "emotional_shift") =>
    clamp(items.reduce((s, p) => s + p[k], 0) / items.length);
  return {
    tension: avg("tension"),
    conflict: avg("conflict"),
    emotional_shift: avg("emotional_shift"),
    turning_point: items.some((p) => p.turning_point),
  };
}

/** Cheap, deterministic signals computed straight from the text. */
export function textMetrics(paragraphs: string[]) {
  const text = paragraphs.join("\n");
  const words = text.split(/\s+/).filter(Boolean).length;
  const dialogueWords = (text.match(/[“"][^”"]{1,2000}[”"]/g) ?? []).join(" ").split(/\s+/).filter(Boolean).length;
  const sentences = text.split(/[.!?]+["”’]?\s/).filter((s) => s.trim().length > 0).length || 1;
  return {
    words,
    dialogue_ratio: words ? Math.round((dialogueWords / words) * 100) / 100 : 0,
    avg_sentence_words: Math.round((words / sentences) * 10) / 10,
  };
}
