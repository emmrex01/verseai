import { describe, expect, it } from "vitest";
import { locateQuote, quoteAppearsIn } from "./evidence";

const p = `“I’ve never been to Paris,” Sarah said — and she meant it.`;

describe("quoteAppearsIn", () => {
  it("matches across curly/straight quotes and dashes", () => {
    expect(quoteAppearsIn(p, `"I've never been to Paris," Sarah said - and`)).toBe(true);
  });
  it("supports ellipsis gaps in order", () => {
    expect(quoteAppearsIn(p, "never been to Paris ... she meant it")).toBe(true);
    expect(quoteAppearsIn(p, "she meant it ... never been to Paris")).toBe(false);
  });
  it("rejects invented text and trivially short quotes", () => {
    expect(quoteAppearsIn(p, "I lived in Paris for two years")).toBe(false);
    expect(quoteAppearsIn(p, "Sarah")).toBe(false);
  });
});

describe("locateQuote", () => {
  const paras = ["Rain fell on the station.", "Daniel checked his watch twice.", p];
  it("keeps a correct index", () => expect(locateQuote(paras, 2, "never been to Paris")).toBe(2));
  it("corrects an off-by-one index", () => expect(locateQuote(paras, 0, "checked his watch twice")).toBe(1));
  it("returns null for a hallucinated quote", () => expect(locateQuote(paras, 1, "the letter burned slowly")).toBeNull());
});
