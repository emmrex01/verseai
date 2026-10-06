import { describe, expect, it } from "vitest";
import { blocksFromHtml, blocksFromPdfPages, blocksFromText } from "./parse";
import { countWords, looksLikeChapterHeading, structureManuscript } from "./structure";

const para = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ") + ".";

describe("countWords", () => {
  it("counts words with apostrophes and hyphens as one", () => {
    expect(countWords("Sarah's well-worn coat — it's red.")).toBe(5);
  });
});

describe("looksLikeChapterHeading", () => {
  it.each(["Chapter 1", "CHAPTER TWELVE", "Chapter Twenty-One", "Chapter IV: The Letter", "Prologue", "Part Two", "12", "# The Station"])(
    "accepts %s",
    (h) => expect(looksLikeChapterHeading(h)).toBe(true),
  );
  it.each(["Chapter 3 was the hardest part of the whole long journey for everyone.", "She walked to the station.", ""])(
    "rejects %s",
    (h) => expect(looksLikeChapterHeading(h)).toBe(false),
  );
});

describe("structureManuscript", () => {
  it("splits on plain-text chapter headings and scene breaks", () => {
    const blocks = blocksFromText(
      ["Chapter 1", "Sarah ran.", "She stopped.", "* * *", "Later, rain.", "Chapter 2", "Daniel waited."].join("\n\n"),
    );
    const m = structureManuscript(blocks);
    expect(m.chaptersDetected).toBe(true);
    expect(m.chapters.map((c) => c.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(m.chapters[0].paragraphs.map((p) => p.sceneIdx)).toEqual([0, 0, 1]);
    expect(m.chapters[0].sceneCount).toBe(2);
    expect(m.wordCount).toBe(8);
  });

  it("merges stacked headings instead of creating empty chapters", () => {
    const m = structureManuscript(blocksFromText(["Part One", "Chapter 1", "Text here.", "Chapter 2", "More."].join("\n\n")));
    expect(m.chapters.map((c) => c.title)).toEqual(["Part One — Chapter 1", "Chapter 2"]);
  });

  it("prefers DOCX heading styles", () => {
    const html = "<h1>The Station</h1><p>One.</p><h1>The Letter</h1><p>Two.</p><p>Chapter 9 is mentioned.</p>";
    const m = structureManuscript(blocksFromHtml(html));
    expect(m.chapters.map((c) => c.title)).toEqual(["The Station", "The Letter"]);
  });

  it("keeps substantial front matter and drops a short title page", () => {
    const withShort = structureManuscript(blocksFromText(["THE LAST WINTER", "Chapter 1", "a.", "Chapter 2", "b."].join("\n\n")));
    expect(withShort.chapters[0].title).toBe("Chapter 1");
    const withLong = structureManuscript(blocksFromText([para(200), "Chapter 1", "a.", "Chapter 2", "b."].join("\n\n")));
    expect(withLong.chapters[0].title).toBe("Opening");
  });

  it("falls back to ~3000-word sections when no headings exist", () => {
    const blocks = Array.from({ length: 8 }, () => ({ text: para(1000) }));
    const m = structureManuscript(blocks);
    expect(m.chaptersDetected).toBe(false);
    expect(m.chapters.map((c) => c.title)).toEqual(["Section 1", "Section 2", "Section 3"]);
  });

  it("gives identical chapters identical hashes", () => {
    const a = structureManuscript(blocksFromText("Chapter 1\n\nSame text.\n\nChapter 2\n\nOld."));
    const b = structureManuscript(blocksFromText("Chapter 1\n\nSame   text.\n\nChapter 2\n\nNew."));
    expect(a.chapters[0].contentHash).toBe(b.chapters[0].contentHash);
    expect(a.chapters[1].contentHash).not.toBe(b.chapters[1].contentHash);
  });
});

describe("blocksFromPdfPages", () => {
  it("rejoins hard-wrapped lines and splits at short sentence-ending lines", () => {
    const page = [
      "Sarah walked down the long platform toward the",
      "waiting train, her coat pulled tight against the",
      "cold.",
      "Daniel was already there.",
    ].join("\n");
    const blocks = blocksFromPdfPages([page]);
    expect(blocks.map((b) => b.text)).toEqual([
      "Sarah walked down the long platform toward the waiting train, her coat pulled tight against the cold.",
      "Daniel was already there.",
    ]);
  });
});
