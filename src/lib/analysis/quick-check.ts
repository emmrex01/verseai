import { addUsage, emptyUsage, mapLimit, type Usage } from "@/lib/ai/client";
import { extractChapter, textMetrics, type BookContext } from "./extract";
import { buildGraph, type StoryGraph } from "./graph";
import { findContradictions, findPacingNotes, findTimelineIssues, findUnresolvedThreads, sortIssues, type Issue } from "./checks";
import type { StructuredManuscript } from "@/lib/manuscript/structure";

export interface InMemoryOptions {
  book?: BookContext;
  /** Ask the reasoning model to merge ambiguous names (full pipeline: true). */
  resolveEntities?: boolean;
  /** Also check plot threads and pacing (full pipeline: true). */
  fullChecks?: boolean;
}

export interface InMemoryResult {
  graph: StoryGraph;
  issues: Issue[];
  stats: { characters: number; locations: number; events: number; chapters: number };
  usage: Usage;
}

/**
 * Analysis without a database: used by the no-account free checker (cheap
 * settings) and by the accuracy eval (full settings, same prompts as the worker).
 */
export async function analyzeInMemory(manuscript: StructuredManuscript, options: InMemoryOptions = {}): Promise<InMemoryResult> {
  const book = options.book ?? { title: "Untitled manuscript", kind: "fiction" as const };
  let usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  const extractions = await mapLimit(manuscript.chapters, 4, async (c, idx) => {
    const { extraction, usage: u } = await extractChapter(book, { idx, title: c.title, paragraphs: c.paragraphs.map((p) => p.text) });
    usage = addUsage(usage, u);
    return { chapterIdx: idx, data: extraction };
  });

  const { graph, usage: gUsage } = await buildGraph(extractions, { resolveWithModel: options.resolveEntities ?? false });
  usage = addUsage(usage, gUsage);

  const checks = await Promise.all([
    findContradictions(graph, book.title),
    findTimelineIssues(graph, book.title),
    options.fullChecks ? findUnresolvedThreads(graph, book.title, manuscript.chapters.length) : Promise.resolve({ issues: [] as Issue[], usage: emptyUsage() }),
  ]);
  usage = addUsage(addUsage(usage, checks[0].usage), checks[1].usage);
  if (options.fullChecks) usage = addUsage(usage, checks[2].usage);

  const pacing = options.fullChecks
    ? findPacingNotes(
        extractions.map(({ chapterIdx, data }) => {
          const c = manuscript.chapters[chapterIdx];
          const paras = c.paragraphs.map((p) => p.text);
          return { idx: chapterIdx, title: c.title, words: c.wordCount, ...data.pacing, dialogue_ratio: textMetrics(paras).dialogue_ratio, anchor: (paras[0] ?? "").split(/\s+/).slice(0, 14).join(" ") };
        }),
      )
    : [];

  return {
    graph,
    issues: sortIssues([...checks[0].issues, ...checks[1].issues, ...checks[2].issues, ...pacing]),
    stats: {
      characters: graph.entities.filter((e) => e.type === "character").length,
      locations: graph.entities.filter((e) => e.type === "location").length,
      events: graph.events.length,
      chapters: manuscript.chapters.length,
    },
    usage,
  };
}

/** The no-account free checker: cheap settings. */
export const quickCheck = (manuscript: StructuredManuscript) => analyzeInMemory(manuscript);
