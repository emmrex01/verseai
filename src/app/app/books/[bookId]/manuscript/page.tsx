import Link from "next/link";
import { clsx } from "clsx";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { EmptyState, ButtonLink } from "@/components/ui";

export default async function ManuscriptPage({ params, searchParams }: PageProps<"/app/books/[bookId]/manuscript">) {
  const { bookId } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);

  if (!book.current_version_id) {
    return <EmptyState title="No manuscript yet" description="Upload a manuscript to read it here." action={<ButtonLink href={`/app/books/${bookId}/upload`}>Upload</ButtonLink>} />;
  }

  const { data: chapters } = await supabase.from("chapters").select("id, idx, title, word_count").eq("version_id", book.current_version_id).order("idx");
  const list = chapters ?? [];
  const chIdx = Math.min(Math.max(0, Number(sp.ch ?? 0) || 0), Math.max(0, list.length - 1));
  const highlight = sp.p !== undefined ? Number(sp.p) : null;
  const chapter = list[chIdx];

  const { data: paragraphs } = chapter
    ? await supabase.from("paragraphs").select("idx, scene_idx, text").eq("chapter_id", chapter.id).order("idx").limit(5000)
    : { data: [] };

  return (
    <div className="grid gap-8 xl:grid-cols-[220px_1fr]">
      <nav aria-label="Chapters" className="max-h-[70vh] overflow-y-auto text-sm xl:sticky xl:top-22">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Chapters</p>
        <ol className="space-y-0.5">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/app/books/${bookId}/manuscript?ch=${c.idx}`} className={clsx("block truncate rounded px-2 py-1", c.idx === chIdx ? "bg-paper font-medium" : "text-muted hover:text-ink")}>
                {c.idx + 1}. {c.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {chapter && (
        <article className="max-w-[42rem]">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">
            Chapter {chapter.idx + 1} · {chapter.word_count.toLocaleString()} words
          </p>
          <h1 className="mb-10 mt-2 font-serif text-3xl">{chapter.title}</h1>
          <div className="prose-manuscript">
            {(paragraphs ?? []).map((p, i, all) => (
              <div key={p.idx}>
                {i > 0 && p.scene_idx !== all[i - 1].scene_idx && (
                  <p className="!indent-0 py-4 text-center text-gold" aria-label="Scene break">
                    ⁂
                  </p>
                )}
                <p id={`p-${p.idx}`} data-highlight={highlight === p.idx}>
                  {p.text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-between border-t border-line pt-6 text-sm">
            {chIdx > 0 ? <Link href={`/app/books/${bookId}/manuscript?ch=${chIdx - 1}`}>← {list[chIdx - 1].title}</Link> : <span />}
            {chIdx < list.length - 1 && <Link href={`/app/books/${bookId}/manuscript?ch=${chIdx + 1}`}>{list[chIdx + 1].title} →</Link>}
          </div>
        </article>
      )}
    </div>
  );
}
