import Link from "next/link";
import { passageHref } from "@/lib/links";

export interface EvidenceItem {
  chapter_idx: number;
  paragraph_idx: number;
  quote: string;
  note?: string;
}

export function EvidenceList({ bookId, evidence, chapterTitles }: { bookId: string; evidence: EvidenceItem[]; chapterTitles: Map<number, string> }) {
  return (
    <div className="space-y-2.5">
      {evidence.map((e, i) => (
        <div key={i} className="rounded-md border-l-2 border-gold bg-paper/70 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-muted">
              Chapter {e.chapter_idx + 1}
              {chapterTitles.get(e.chapter_idx) ? ` · ${chapterTitles.get(e.chapter_idx)}` : ""}
            </p>
            <Link href={passageHref(bookId, e.chapter_idx, e.paragraph_idx)} className="shrink-0 text-xs text-burgundy underline-offset-2 hover:underline">
              View in manuscript
            </Link>
          </div>
          <p className="mt-1 font-serif text-[15px] leading-relaxed">“{e.quote}”</p>
          {e.note && <p className="mt-1 text-xs text-muted">{e.note}</p>}
        </div>
      ))}
    </div>
  );
}
