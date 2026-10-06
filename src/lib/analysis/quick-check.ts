import { addUsage, mapLimit, type Usage } from "@/lib/ai/client";
import { extractChapter } from "./extract";
import { buildGraph } from "./graph";
import { findContradictions, findTimelineIssues, sortIssues, type Issue } from "./checks";
import type { StructuredManuscript } from "@/lib/manuscript/structure";

/** In-memory analysis for the no-account free checker: no storage, no profiles. */
export async function quickCheck(manuscript: StructuredManuscript): Promise<{ issues: Issue[]; stats: { characters: number; locations: number; events: number; chapters: number }; usage: Usage }> {
  const book = { title: "Untitled manuscript", kind: "fiction" as const };
  let usage: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

  const extractions = await mapLimit(manuscript.chapters, 4, async (c, idx) => {
    const { extraction, usage: u } = await extractChapter(book, { idx, title: c.title, paragraphs: c.paragraphs.map((p) => p.text) });
    usage = addUsage(usage, u);
    return { chapterIdx: idx, data: extraction };
  });

  const { graph, usage: gUsage } = await buildGraph(extractions, { resolveWithModel: false });
  usage = addUsage(usage, gUsage);

  const [contradictions, timeline] = await Promise.all([findContradictions(graph, book.title), findTimelineIssues(graph, book.title)]);
  usage = addUsage(addUsage(usage, contradictions.usage), timeline.usage);

  return {
    issues: sortIssues([...contradictions.issues, ...timeline.issues]),
    stats: {
      characters: graph.entities.filter((e) => e.type === "character").length,
      locations: graph.entities.filter((e) => e.type === "location").length,
      events: graph.events.length,
      chapters: manuscript.chapters.length,
    },
    usage,
  };
}
