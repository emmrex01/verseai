import Link from "next/link";
import { clsx } from "clsx";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { passageHref } from "@/lib/links";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function TimelinePage({ params, searchParams }: PageProps<"/app/books/[bookId]/timeline">) {
  const { bookId } = await params;
  const { all } = await searchParams;
  const showAll = all === "1";
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);

  let q = supabase.from("timeline_events").select("id, seq, chapter_idx, paragraph_idx, summary, time_marker, significance, entity_names").eq("book_id", bookId).order("seq").limit(2000);
  if (!showAll) q = q.eq("significance", "major");
  const [{ data: events }, { data: chapters }] = await Promise.all([q, supabase.from("chapters").select("idx, title").eq("version_id", book.current_version_id ?? "")]);
  const titles = new Map((chapters ?? []).map((c) => [c.idx, c.title]));
  const grouped = new Map<number, NonNullable<typeof events>>();
  for (const e of events ?? []) grouped.set(e.chapter_idx, [...(grouped.get(e.chapter_idx) ?? []), e]);

  return (
    <div>
      <PageHeader
        eyebrow="Story Bible"
        title="Timeline"
        description="Events in reading order, with the time markers your text gives. Timeline conflicts appear under Consistency."
        actions={
          <div className="flex gap-1.5 text-sm">
            <Link href={`/app/books/${bookId}/timeline`} className={clsx("rounded-md border px-3 py-1.5", !showAll ? "border-ink" : "border-line text-muted")}>
              Major events
            </Link>
            <Link href={`/app/books/${bookId}/timeline?all=1`} className={clsx("rounded-md border px-3 py-1.5", showAll ? "border-ink" : "border-line text-muted")}>
              All events
            </Link>
          </div>
        }
      />
      {(events ?? []).length === 0 ? (
        <EmptyState title="No events yet" description="Your timeline appears after your manuscript is analyzed." />
      ) : (
        <ol className="relative border-l border-line pl-6">
          {[...grouped.entries()].map(([ch, items]) => (
            <li key={ch} className="mb-10">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-gold" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Chapter {ch + 1} · {titles.get(ch)}
              </p>
              <ul className="mt-3 space-y-3">
                {items.map((e) => (
                  <li key={e.id}>
                    <Link href={passageHref(bookId, e.chapter_idx, e.paragraph_idx)} className="block rounded-md px-3 py-2 hover:bg-paper">
                      {e.time_marker && <span className="mr-2 rounded bg-gold-soft px-1.5 py-0.5 text-xs text-[#7d5f2c]">{e.time_marker}</span>}
                      <span className={clsx("text-sm", e.significance === "major" && "font-medium")}>{e.summary}</span>
                      {e.entity_names.length > 0 && <span className="mt-0.5 block text-xs text-muted">{e.entity_names.slice(0, 5).join(", ")}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
