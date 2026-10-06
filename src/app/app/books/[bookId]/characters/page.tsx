import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const ROLE_ORDER = ["protagonist", "antagonist", "major", "supporting", "minor"];

export default async function CharactersPage({ params }: PageProps<"/app/books/[bookId]/characters">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  await getBook(supabase, bookId);
  const { data } = await supabase
    .from("entities")
    .select("id, name, aliases, role, summary, mention_count, first_chapter_idx, chapters_present")
    .eq("book_id", bookId)
    .eq("type", "character")
    .order("mention_count", { ascending: false });
  const characters = [...(data ?? [])].sort((a, b) => {
    const ra = a.role ? ROLE_ORDER.indexOf(a.role) : 9;
    const rb = b.role ? ROLE_ORDER.indexOf(b.role) : 9;
    return ra - rb || b.mention_count - a.mention_count;
  });

  return (
    <div>
      <PageHeader eyebrow="Story Bible" title="Characters" description="Everyone your manuscript names, with profiles built only from what your text says." />
      {characters.length === 0 ? (
        <EmptyState title="No characters yet" description="Characters appear here after your manuscript is analyzed." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {characters.map((c) => (
            <Link key={c.id} href={`/app/books/${bookId}/characters/${c.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-ink/40">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-serif text-lg">{c.name}</p>
                  {c.role && <Badge className="capitalize">{c.role}</Badge>}
                </div>
                {c.aliases?.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">Also: {c.aliases.slice(0, 4).join(", ")}</p>}
                {c.summary && <p className="mt-3 line-clamp-3 text-sm text-muted">{c.summary}</p>}
                <p className="mt-4 text-xs text-muted">
                  {c.chapters_present.length} {c.chapters_present.length === 1 ? "chapter" : "chapters"}
                  {c.first_chapter_idx !== null ? ` · first in Ch ${c.first_chapter_idx + 1}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
