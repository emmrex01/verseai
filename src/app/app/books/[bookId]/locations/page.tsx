import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const GROUPS: [string, string][] = [
  ["location", "Places"],
  ["object", "Objects"],
  ["organization", "Organizations"],
];

export default async function LocationsPage({ params }: PageProps<"/app/books/[bookId]/locations">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  await getBook(supabase, bookId);
  const { data } = await supabase
    .from("entities")
    .select("id, name, type, summary, chapters_present, first_chapter_idx")
    .eq("book_id", bookId)
    .neq("type", "character")
    .order("mention_count", { ascending: false });

  return (
    <div>
      <PageHeader eyebrow="Story Bible" title="Places & objects" description="The settings, important objects and organizations in your story." />
      {(data ?? []).length === 0 ? (
        <EmptyState title="Nothing here yet" description="Places and objects appear after your manuscript is analyzed." />
      ) : (
        <div className="space-y-10">
          {GROUPS.map(([type, label]) => {
            const items = (data ?? []).filter((e) => e.type === type);
            if (!items.length) return null;
            return (
              <section key={type}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {label} ({items.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((e) => (
                    <Link key={e.id} href={`/app/books/${bookId}/characters/${e.id}`}>
                      <Card className="h-full p-4 transition-colors hover:border-ink/40">
                        <p className="font-serif text-lg">{e.name}</p>
                        {e.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{e.summary}</p>}
                        <p className="mt-2 text-xs text-muted">
                          {e.chapters_present.length} ch{e.first_chapter_idx !== null ? ` · first in Ch ${e.first_chapter_idx + 1}` : ""}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
