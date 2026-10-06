import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { passageHref } from "@/lib/links";
import { Card, EmptyState, PageHeader } from "@/components/ui";

interface Ref {
  id: string;
  name: string;
}

export default async function RelationshipsPage({ params }: PageProps<"/app/books/[bookId]/relationships">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  await getBook(supabase, bookId);
  const { data } = await supabase
    .from("relationships")
    .select("id, kind, description, evidence, source:entities!relationships_source_entity_id_fkey(id, name), target:entities!relationships_target_entity_id_fkey(id, name)")
    .eq("book_id", bookId);
  const one = (r: Ref | Ref[] | null) => (Array.isArray(r) ? r[0] : r);

  return (
    <div>
      <PageHeader eyebrow="Story Bible" title="Relationships" description="Who is connected to whom — and the passage that establishes it." />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No relationships yet" description="Relationships appear after your manuscript is analyzed." />
      ) : (
        <Card className="divide-y divide-line">
          {(data ?? []).map((r) => {
            const a = one(r.source as Ref | Ref[] | null);
            const b = one(r.target as Ref | Ref[] | null);
            const ev = (r.evidence as { chapter_idx: number; paragraph_idx: number; quote: string }[])[0];
            if (!a || !b) return null;
            return (
              <div key={r.id} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1.4fr_1fr_1.6fr] md:items-center">
                <p>
                  <Link href={`/app/books/${bookId}/characters/${a.id}`} className="font-medium hover:text-burgundy">
                    {a.name}
                  </Link>
                  <span className="mx-2 text-muted">↔</span>
                  <Link href={`/app/books/${bookId}/characters/${b.id}`} className="font-medium hover:text-burgundy">
                    {b.name}
                  </Link>
                </p>
                <p className="capitalize text-gold">{r.kind}</p>
                <div className="text-muted">
                  {r.description}
                  {ev && (
                    <Link href={passageHref(bookId, ev.chapter_idx, ev.paragraph_idx)} className="ml-2 text-xs text-burgundy hover:underline">
                      Ch {ev.chapter_idx + 1}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
