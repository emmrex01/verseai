import { describe, expect, it } from "vitest";
import { buildGraph, normalizeName } from "./graph";
import { findPacingNotes, fingerprint, sortIssues, type ChapterPacing, type Issue } from "./checks";
import type { ChapterExtraction } from "./extract";

const pacing = { tension: 5, conflict: 5, emotional_shift: 5, turning_point: false };

function chapter(partial: Partial<ChapterExtraction>): ChapterExtraction {
  return { summary: "", entities: [], facts: [], relationships: [], events: [], threads: [], pacing, dropped: 0, ...partial };
}

describe("normalizeName", () => {
  it("strips possessives, articles and punctuation", () => {
    expect(normalizeName("Sarah’s")).toBe("sarah");
    expect(normalizeName("The Old Mill")).toBe("old mill");
  });
});

describe("buildGraph (without model resolution)", () => {
  it("merges entities across chapters by name and alias, and attaches facts", async () => {
    const { graph } = await buildGraph(
      [
        {
          chapterIdx: 0,
          data: chapter({
            entities: [{ name: "Sarah Mitchell", type: "character", aliases: ["Sarah"], descriptor: "journalist" }],
            facts: [{ entity: "Sarah", category: "background", statement: "Sarah says she has never been to Paris", paragraph: 2, quote: "I've never been to Paris" }],
          }),
        },
        {
          chapterIdx: 3,
          data: chapter({
            entities: [{ name: "Sarah", type: "character", aliases: [], descriptor: "lived in Montmartre" }],
            facts: [{ entity: "Sarah Mitchell", category: "background", statement: "Sarah lived in Paris for two years", paragraph: 5, quote: "Two years in that Montmartre flat" }],
          }),
        },
      ],
      { resolveWithModel: false },
    );
    const characters = graph.entities.filter((e) => e.type === "character");
    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe("Sarah Mitchell");
    expect(characters[0].chapters).toEqual([0, 3]);
    expect(graph.facts).toHaveLength(2);
    expect(new Set(graph.facts.map((f) => f.entityKey)).size).toBe(1);
  });

  it("keeps same-surname people apart and drops self-relationships", async () => {
    const { graph } = await buildGraph(
      [
        {
          chapterIdx: 0,
          data: chapter({
            entities: [
              { name: "Sarah Mitchell", type: "character", aliases: [], descriptor: "" },
              { name: "Helen Mitchell", type: "character", aliases: [], descriptor: "mother" },
            ],
            relationships: [
              { a: "Sarah Mitchell", b: "Helen Mitchell", kind: "parent", description: "Helen is Sarah's mother", paragraph: 1, quote: "her mother Helen" },
              { a: "Sarah Mitchell", b: "Sarah Mitchell", kind: "self", description: "", paragraph: 1, quote: "x" },
            ],
          }),
        },
      ],
      { resolveWithModel: false },
    );
    expect(graph.entities.filter((e) => e.type === "character")).toHaveLength(2);
    expect(graph.relationships).toHaveLength(1);
  });

  it("numbers events in reading order", async () => {
    const ev = (summary: string, paragraph: number) => ({ summary, time_marker: null, significance: "major" as const, participants: [], paragraph, quote: summary });
    const { graph } = await buildGraph(
      [
        { chapterIdx: 0, data: chapter({ events: [ev("b", 9), ev("a", 1)] }) },
        { chapterIdx: 1, data: chapter({ events: [ev("c", 0)] }) },
      ],
      { resolveWithModel: false },
    );
    expect(graph.events.map((e) => e.summary)).toEqual(["a", "b", "c"]);
    expect(graph.events.map((e) => e.seq)).toEqual([0, 1, 2]);
  });
});

describe("findPacingNotes", () => {
  const ch = (idx: number, m: number, extra: Partial<ChapterPacing> = {}): ChapterPacing => ({
    idx, title: `Chapter ${idx + 1}`, words: 3000, tension: m, conflict: m, emotional_shift: m, turning_point: true, dialogue_ratio: 0.3, anchor: "It began", ...extra,
  });

  it("flags a chapter far below its neighbours, as a recommendation", () => {
    const notes = findPacingNotes([ch(0, 7), ch(1, 7), ch(2, 2, { turning_point: false }), ch(3, 7), ch(4, 7)]);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toContain("Chapter 3");
    expect(notes[0].possible_intent).toBeTruthy();
  });

  it("does nothing for short manuscripts or even pacing", () => {
    expect(findPacingNotes([ch(0, 7), ch(1, 2)])).toEqual([]);
    expect(findPacingNotes([0, 1, 2, 3, 4, 5].map((i) => ch(i, 6)))).toEqual([]);
  });
});

describe("issue fingerprints", () => {
  const ev = [{ chapter_idx: 1, paragraph_idx: 2, quote: "I've never been to Paris" }];
  it("is stable regardless of name order and paragraph shifts", () => {
    const a = fingerprint("character", ["Sarah", "Daniel"], ev);
    const b = fingerprint("character", ["daniel", "sarah"], [{ ...ev[0], paragraph_idx: 7 }]);
    expect(a).toBe(b);
  });
  it("dedupes and sorts by severity", () => {
    const issue = (severity: Issue["severity"], fp: string): Issue => ({ category: "character", severity, title: fp, explanation: "", possible_intent: null, suggestion: null, entity_names: [], evidence: [], fingerprint: fp });
    expect(sortIssues([issue("low", "a"), issue("critical", "b"), issue("low", "a")]).map((i) => i.fingerprint)).toEqual(["b", "a"]);
  });
});
