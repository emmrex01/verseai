import Link from "next/link";
import { clsx } from "clsx";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { Badge, Card, EmptyState, PageHeader, SeverityBadge, type Severity } from "@/components/ui";
import { EvidenceList, type EvidenceItem } from "@/components/evidence-list";
import { IssueActions } from "@/components/issue-actions";

const CATEGORIES = ["all", "character", "timeline", "location", "object", "plot", "pacing"] as const;
const STATUSES = ["open", "resolved", "dismissed"] as const;
const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default async function IssuesPage({ params, searchParams }: PageProps<"/app/books/[bookId]/issues">) {
  const { bookId } = await params;
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.category as (typeof CATEGORIES)[number]) ? (sp.category as string) : "all";
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as string) : "open";
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);

  let query = supabase.from("issues").select("*").eq("book_id", bookId).eq("status", status);
  if (category !== "all") query = query.eq("category", category);
  const [{ data: issues }, { data: chapters }, { data: all }] = await Promise.all([
    query,
    supabase.from("chapters").select("idx, title").eq("version_id", book.current_version_id ?? ""),
    supabase.from("issues").select("status, category").eq("book_id", bookId),
  ]);
  const titles = new Map((chapters ?? []).map((c) => [c.idx, c.title]));
  const sorted = [...(issues ?? [])].sort((a, b) => RANK[a.severity as Severity] - RANK[b.severity as Severity]);
  const countFor = (s: string) => (all ?? []).filter((i) => i.status === s && (category === "all" || i.category === category)).length;
  const href = (next: Partial<{ category: string; status: string }>) => `/app/books/${bookId}/issues?category=${next.category ?? category}&status=${next.status ?? status}`;

  return (
    <div>
      <PageHeader
        eyebrow="Analyze"
        title="Consistency"
        description="Potential inconsistencies Verse found by comparing what your manuscript says across chapters. Each one shows its evidence — you decide what's a problem. Issues you mark as intentional won't come back when you re-analyze."
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <Link key={c} href={href({ category: c })} className={clsx("rounded-md px-3 py-1.5 text-sm capitalize", c === category ? "bg-ink text-ivory" : "text-muted hover:bg-paper")}>
              {c === "all" ? "All" : c}
            </Link>
          ))}
        </div>
        <div className="flex gap-1.5 text-sm">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s })} className={clsx("rounded-md border px-3 py-1.5 capitalize", s === status ? "border-ink" : "border-line text-muted hover:bg-paper")}>
              {s === "resolved" ? "Fixed" : s === "dismissed" ? "Intentional" : "Open"} ({countFor(s)})
            </Link>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title={status === "open" ? "Nothing to fix here" : "Nothing in this list"}
          description={status === "open" ? "No open potential inconsistencies in this category. Re-analyze after revising to check again." : "Issues you mark appear here."}
        />
      ) : (
        <div className="space-y-4">
          {sorted.map((i) => (
            <Card key={i.id} id={i.id} className="scroll-mt-24 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={i.severity as Severity} />
                    <Badge className="capitalize">{i.category}</Badge>
                    {(i.entity_names as string[]).slice(0, 3).map((n) => (
                      <Badge key={n}>{n}</Badge>
                    ))}
                  </div>
                  <h2 className="mt-3 font-serif text-xl">{i.title}</h2>
                </div>
                <IssueActions issueId={i.id} status={i.status} />
              </div>
              <p className="mt-3 text-sm leading-relaxed">{i.explanation}</p>
              <div className="mt-5">
                <EvidenceList bookId={bookId} evidence={i.evidence as EvidenceItem[]} chapterTitles={titles} />
              </div>
              {(i.possible_intent || i.suggestion) && (
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {i.possible_intent && (
                    <p className="rounded-md bg-paper p-3 text-muted">
                      <span className="font-medium text-ink">Could be intentional: </span>
                      {i.possible_intent}
                    </p>
                  )}
                  {i.suggestion && (
                    <p className="rounded-md bg-sage-soft/60 p-3 text-muted">
                      <span className="font-medium text-ink">Suggestion: </span>
                      {i.suggestion}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
