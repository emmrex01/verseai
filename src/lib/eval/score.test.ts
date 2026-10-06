import { describe, expect, it } from "vitest";
import type { Issue } from "@/lib/analysis/checks";
import { matches, scoreIssues, type EvalSpec } from "./score";

const issue = (title: string, quotes: [number, string][], explanation = ""): Issue => ({
  category: "character",
  severity: "high",
  title,
  explanation,
  possible_intent: null,
  suggestion: null,
  entity_names: [],
  evidence: quotes.map(([ch, quote]) => ({ chapter_idx: ch - 1, paragraph_idx: 0, quote })),
  fingerprint: title,
});

const spec: EvalSpec = {
  title: "t",
  expected: [{ id: "eyes", description: "", keywords: ["eye", "green", "brown"], minKeywords: 2, chapters: [1, 3] }],
  decoys: [{ id: "hair", description: "", keywords: ["hair", "dye"], minKeywords: 2 }],
};

describe("matches", () => {
  it("needs enough keywords and every required chapter", () => {
    expect(matches(issue("Eye colour", [[1, "bright green eyes"], [3, "dark brown"]]), spec.expected[0])).toBe(true);
    expect(matches(issue("Eye colour", [[1, "bright green eyes"]]), spec.expected[0])).toBe(false);
    expect(matches(issue("Something", [[1, "a"], [3, "b"]]), spec.expected[0])).toBe(false);
  });
});

describe("scoreIssues", () => {
  it("computes recall, decoy false positives and unmatched issues", () => {
    const r = scoreIssues(
      [
        issue("Sarah's eyes", [[1, "bright green eyes"], [3, "dark brown"]]),
        issue("Hair colour changes", [[3, "dyed her hair black"]]),
        issue("Weather in chapter 2", [[2, "rain"]]),
      ],
      spec,
    );
    expect(r.found).toEqual(["eyes"]);
    expect(r.missed).toEqual([]);
    expect(r.recall).toBe(1);
    expect(r.decoyHits).toHaveLength(1);
    expect(r.unmatched).toEqual(["Weather in chapter 2"]);
    expect(r.precisionHigh).toBe(0.5);
    expect(r.precisionLow).toBeCloseTo(1 / 3);
  });
});
