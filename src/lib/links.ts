/** Deep link to a paragraph in the manuscript reader. */
export function passageHref(bookId: string, chapterIdx: number, paragraphIdx: number) {
  return `/app/books/${bookId}/manuscript?ch=${chapterIdx}&p=${paragraphIdx}#p-${paragraphIdx}`;
}
