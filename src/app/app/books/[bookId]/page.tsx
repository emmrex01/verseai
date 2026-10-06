import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getBook, getRuns, getVersion } from "@/lib/books";
import { AnalysisProgress } from "@/components/analysis-progress";
import { ManuscriptUpload } from "@/components/manuscript-upload";
import { ReanalyzeButton } from "@/components/reanalyze-button";
import { PacingChart, type PacingPoint } from "@/components/pacing-chart";
import { ButtonLink, Card, SeverityBadge, type Severity } from "@/components/ui";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

export default async function BookOverviewPage({ params }: PageProps<"/app/books/[bookId]">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);
  const [runs, version] = await Promise.all([getRuns(supabase, bookId), getVersion(supabase, book.current_version_id)]);

  if (!version) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl">{book.title}</h1>
        <p className="mt-2 text-sm text-muted">Upload your manuscript to build the Story Bible.</p>
        <div className="mt-8">
          <ManuscriptUpload bookId={bookId} />
        </div>
      </div>
    );
  }

  const [{ data: issues }, { data: entities }, { count: eventCount }, { count: relCount }, { data: chapters }] = await Promise.all([
    supabase.from("issues").select("id, title, severity, category, status").eq("book_id", bookId),
    supabase.from("entities").select("id, name, type, role, summary, mention_count, chapters_present").eq("book_id", bookId).order("mention_count", { ascending: false }),
    supabase.from("timeline_events").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    supabase.from("relationships").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    supabase.from("chapters").select("idx, title, word_count, metrics").eq("version_id", version.id).order("idx"),
  ]);

  const open = (issues ?? []).filter((i) => i.status === "open");
  const characters = (entities ?? []).filter((e) => e.type === "character");
  const places = (entities ?? []).filter((e) => e.type === "location");
  const analyzed = Boolean(runs.lastSucceeded);
  const pacing: PacingPoint[] = (chapters ?? []).map((c) => ({ idx: c.idx, title: c.title, words: c.word_count, ...(c.metrics as object) }));
  const hasPacing = pacing.some((p) => p.tension);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl">{book.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[book.genre, `${version.word_count.toLocaleString()} words`, `${version.chapter_count} chapters`, `version ${version.version_no}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <ButtonLink href={`/app/books/${bookId}/upload`} variant="secondary">
            <Upload className="h-4 w-4" aria-hidden /> New version
          </ButtonLink>
          {!runs.active && <ReanalyzeButton bookId={bookId} label={analyzed ? "Re-analyze" : "Analyze"} />}
        </div>
      </div>

      {runs.active && (
        <div className="mt-8">
          <AnalysisProgress runId={runs.active.id} initial={runs.active} kind={runs.active.kind} />
        </div>
      )}
      {!runs.active && runs.latestAnalysis?.status === "failed" && (
        <Card className="mt-8 border-critical/30 p-5 text-sm">
          <p className="font-medium">The last analysis didn&apos;t finish.</p>
          <p className="mt-1 text-muted">{runs.latestAnalysis.error}</p>
        </Card>
      )}
      {!runs.active && !runs.latestAnalysis && (
        <Card className="mt-8 p-5 text-sm">
          <p className="font-medium">Your manuscript is uploaded but not analyzed yet.</p>
          <p className="mt-1 text-muted">Start an analysis to build your Story Bible and run the consistency check.</p>
        </Card>
      )}

      {analyzed && runs.lastSucceeded?.chapter_limit != null && runs.lastSucceeded.version_id === version.id && runs.lastSucceeded.chapter_limit < version.chapter_count - 1 && (
        <Card className="mt-8 flex flex-col gap-4 border-gold/60 bg-gold-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium">
              Verse analyzed chapters 1–{runs.lastSucceeded.chapter_limit + 1} of {version.chapter_count}.
            </p>
            <p className="mt-0.5 text-muted">Your plan covers the opening of this book. Upgrade to check every chapter — most continuity problems span distant chapters.</p>
          </div>
          <ButtonLink href="/app/billing" variant="accent">
            Analyze the whole book
          </ButtonLink>
        </Card>
      )}

      {analyzed && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              [characters.length, "Characters", "characters"],
              [places.length, "Places", "locations"],
              [eventCount ?? 0, "Timeline events", "timeline"],
              [relCount ?? 0, "Relationships", "relationships"],
            ].map(([n, label, path]) => (
              <Link key={label as string} href={`/app/books/${bookId}/${path}`}>
                <Card className="p-5 transition-colors hover:border-ink/40">
                  <p className="font-serif text-3xl">{n as number}</p>
                  <p className="mt-1 text-xs text-muted">{label as string}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl">Needs attention</h2>
                <Link href={`/app/books/${bookId}/issues`} className="text-xs text-muted underline">
                  All issues
                </Link>
              </div>
              {open.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No open issues. {issues?.length ? "Nice work." : "Verse didn't find any potential inconsistencies."}</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    {SEVERITIES.map((s) => {
                      const n = open.filter((i) => i.severity === s).length;
                      return n ? (
                        <span key={s} className="flex items-center gap-2">
                          <SeverityBadge severity={s} /> {n}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <ul className="mt-5 divide-y divide-line border-t border-line">
                    {open.slice(0, 6).map((i) => (
                      <li key={i.id}>
                        <Link href={`/app/books/${bookId}/issues#${i.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-burgundy">
                          <span className="truncate">{i.title}</span>
                          <SeverityBadge severity={i.severity as Severity} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl">Main characters</h2>
                <Link href={`/app/books/${bookId}/characters`} className="text-xs text-muted underline">
                  All characters
                </Link>
              </div>
              <ul className="mt-4 space-y-3">
                {characters.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link href={`/app/books/${bookId}/characters/${c.id}`} className="block hover:text-burgundy">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="ml-2 text-xs capitalize text-muted">{c.role ?? ""} · {c.chapters_present.length} ch</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {hasPacing && (
            <Card className="mt-6 p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-serif text-xl">Story momentum</h2>
                <Link href={`/app/books/${bookId}/pacing`} className="text-xs text-muted underline">
                  Pacing details
                </Link>
              </div>
              <PacingChart points={pacing} bookId={bookId} height={120} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
