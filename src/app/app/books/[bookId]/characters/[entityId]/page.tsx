import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { passageHref } from "@/lib/links";
import { Badge, Card, SeverityBadge, type Severity } from "@/components/ui";

const FIELDS: [string, string][] = [
  ["goal", "Goal"],
  ["motivation", "Motivation"],
  ["fear", "Fear"],
  ["arc", "Arc"],
  ["age", "Age"],
  ["appearance", "Appearance"],
  ["personality", "Personality"],
];

export default async function EntityPage({ params }: PageProps<"/app/books/[bookId]/characters/[entityId]">) {
  const { bookId, entityId } = await params;
  const { supabase } = await requireUser();
  await getBook(supabase, bookId);

  const { data: entity } = await supabase.from("entities").select("*").eq("id", entityId).eq("book_id", bookId).maybeSingle();
  if (!entity) notFound();

  const [{ data: facts }, { data: rels }, { data: issues }] = await Promise.all([
    supabase.from("entity_facts").select("id, chapter_idx, paragraph_idx, category, statement, quote").eq("entity_id", entityId).order("chapter_idx").order("paragraph_idx"),
    supabase
      .from("relationships")
      .select("id, kind, description, source_entity_id, target_entity_id, source:entities!relationships_source_entity_id_fkey(id, name, type), target:entities!relationships_target_entity_id_fkey(id, name, type)")
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`),
    supabase.from("issues").select("id, title, severity, status").eq("book_id", bookId).contains("entity_names", [entity.name]),
  ]);

  const profile = (entity.profile ?? {}) as Record<string, string | null>;
  const byChapter = new Map<number, NonNullable<typeof facts>>();
  for (const f of facts ?? []) byChapter.set(f.chapter_idx, [...(byChapter.get(f.chapter_idx) ?? []), f]);
  const back = entity.type === "character" ? "characters" : "locations";

  return (
    <div>
      <Link href={`/app/books/${bookId}/${back}`} className="text-sm text-muted hover:text-ink">
        ← {entity.type === "character" ? "Characters" : "Places & objects"}
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-serif text-4xl tracking-wide">{entity.name}</h1>
        {entity.role && <Badge className="capitalize">{entity.role}</Badge>}
        {entity.type !== "character" && <Badge className="capitalize">{entity.type}</Badge>}
      </div>
      {entity.aliases?.length > 0 && <p className="mt-1 text-sm text-muted">Also called {entity.aliases.join(", ")}</p>}
      <p className="mt-1 text-sm text-gold">
        Appears in {entity.chapters_present.length} {entity.chapters_present.length === 1 ? "chapter" : "chapters"}
        {entity.first_chapter_idx !== null && ` · Ch ${entity.first_chapter_idx + 1}–${entity.last_chapter_idx + 1}`}
      </p>
      {entity.summary && <p className="mt-5 max-w-3xl leading-relaxed">{entity.summary}</p>}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {entity.type === "character" && Object.keys(profile).length > 0 && (
            <Card className="grid gap-5 p-6 sm:grid-cols-2">
              {FIELDS.map(([k, label]) => (
                <div key={k}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
                  <p className={`mt-1 text-sm ${profile[k] ? "" : "text-muted/70 italic"}`}>{profile[k] ?? "Not established in the manuscript"}</p>
                </div>
              ))}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-serif text-xl">What the manuscript says</h2>
            <p className="mt-1 text-xs text-muted">Every statement links to the passage it comes from.</p>
            {(facts ?? []).length === 0 && <p className="mt-4 text-sm text-muted">No specific facts recorded yet.</p>}
            <div className="mt-5 space-y-6">
              {[...byChapter.entries()].map(([ch, items]) => (
                <div key={ch}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Chapter {ch + 1}</p>
                  <ul className="space-y-2">
                    {items.map((f) => (
                      <li key={f.id} className="text-sm">
                        <Link href={passageHref(bookId, f.chapter_idx, f.paragraph_idx)} className="group block rounded-md px-3 py-2 hover:bg-paper">
                          <span className="mr-2 text-[11px] uppercase tracking-wider text-gold">{f.category}</span>
                          {f.statement}
                          <span className="mt-0.5 block font-serif text-[13px] italic text-muted group-hover:text-ink">“{f.quote}”</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {(issues ?? []).length > 0 && (
            <Card className="p-5">
              <h2 className="font-serif text-lg">Consistency</h2>
              <ul className="mt-3 space-y-2">
                {(issues ?? []).map((i) => (
                  <li key={i.id}>
                    <Link href={`/app/books/${bookId}/issues?status=${i.status}#${i.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-burgundy">
                      <span className="truncate">{i.title}</span>
                      <SeverityBadge severity={i.severity as Severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-serif text-lg">Relationships</h2>
            {(rels ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">None recorded.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {(rels ?? []).map((r) => {
                  const otherRaw = r.source_entity_id === entityId ? r.target : r.source;
                  const other = (Array.isArray(otherRaw) ? otherRaw[0] : otherRaw) as { id: string; name: string; type: string } | null;
                  if (!other) return null;
                  return (
                    <li key={r.id} className="py-2.5 text-sm">
                      <Link href={`/app/books/${bookId}/characters/${other.id}`} className="font-medium hover:text-burgundy">
                        {other.name}
                      </Link>
                      <span className="ml-2 text-muted">{r.kind}</span>
                      {r.description && <p className="mt-0.5 text-xs text-muted">{r.description}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
