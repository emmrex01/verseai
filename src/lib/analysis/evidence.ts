/**
 * Every claim Verse shows an author must point at real text. Model output
 * cites a paragraph and a short verbatim quote; we accept the citation only if
 * the quote actually appears in the manuscript, correcting the paragraph index
 * when the model is off by a little.
 */

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\p{L}\p{N}'"\-.,!?;:\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` occurs in `paragraph`; "..." in a quote may skip text. */
export function quoteAppearsIn(paragraph: string, quote: string): boolean {
  const hay = normalizeForMatch(paragraph);
  const pieces = normalizeForMatch(quote)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\s*\.\.\.\s*/)
    .map((p) => p.replace(/^["'\s]+|["'\s]+$/g, ""))
    .filter((p) => p.length > 0);
  if (pieces.length === 0) return false;
  // Very short fragments ("he", "yes") are not evidence.
  if (pieces.join(" ").length < 8) return false;
  let from = 0;
  for (const piece of pieces) {
    const at = hay.indexOf(piece, from);
    if (at === -1) return false;
    from = at + piece.length;
  }
  return true;
}

/**
 * Returns the paragraph index where the quote really is: the cited one, a
 * nearby one, or anywhere in the chapter. null means the quote is not real.
 */
export function locateQuote(paragraphs: string[], citedIdx: number, quote: string): number | null {
  if (citedIdx >= 0 && citedIdx < paragraphs.length && quoteAppearsIn(paragraphs[citedIdx], quote)) {
    return citedIdx;
  }
  for (let d = 1; d <= 3; d++) {
    for (const i of [citedIdx - d, citedIdx + d]) {
      if (i >= 0 && i < paragraphs.length && quoteAppearsIn(paragraphs[i], quote)) return i;
    }
  }
  const anywhere = paragraphs.findIndex((p) => quoteAppearsIn(p, quote));
  return anywhere === -1 ? null : anywhere;
}
