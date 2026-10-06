import Link from "next/link";
import { clsx } from "clsx";
import { requireUser } from "@/lib/supabase/server";
import { getBook, getRuns } from "@/lib/books";
import { getAllowance } from "@/lib/billing/usage";
import { passageHref } from "@/lib/links";
import type { ReportData } from "@/lib/analysis/report";
import { AnalysisProgress } from "@/components/analysis-progress";
import { GenerateReportButton, PrintButton } from "@/components/report-actions";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const BEAT_STYLE: Record<string, string> = {
  strong: "bg-sage-soft text-sage",
  present: "bg-paper text-ink",
  weak: "bg-amber-soft text-amber",
  missing: "bg-critical-soft text-critical",
};

const REACTION_STYLE: Record<string, string> = {
  hooked: "text-sage",
  moved: "text-sage",
  engaged: "text-ink",
  slowing: "text-amber",
  confused: "text-critical",
};

export default async function ReportPage({ params, searchParams }: PageProps<"/app/books/[bookId]/report">) {
  const { bookId } = await params;
  const { id } = await searchParams;
  const { supabase, user } = await requireUser();
  const book = await getBook(supabase, bookId);
  const [runs, allowance, { data: reports }] = await Promise.all([
    getRuns(supabase, bookId),
    getAllowance(supabase, user.id),
    supabase.from("editorial_reports").select("id, created_at, chapters_covered, version_id, data").eq("book_id", bookId).order("created_at", { ascending: false }).limit(10),
  ]);

  const report = (reports ?? []).find((r) => r.id === id) ?? reports?.[0];
  const activeReport = runs.active?.kind === "report" ? runs.active : null;
  const canGenerate = Boolean(runs.lastSucceeded) && !runs.active;
  const remaining = `${allowance.reportsRemaining} of ${allowance.plan.monthlyReports} reports left this month`;

  if (!report) {
    return (
      <div className="max-w-3xl">
        <PageHeader
          eyebrow="Analyze"
          title="Editorial report"
          description="A developmental edit of your whole manuscript: structure, strengths, the problems worth fixing first, how readers will experience it, and a revision plan in the right order."
        />
        {activeReport ? (
          <AnalysisProgress runId={activeReport.id} initial={activeReport} kind="report" />
        ) : (
          <EmptyState
            title={runs.lastSucceeded ? "Ready when you are" : "Analyze your manuscript first"}
            description={
              runs.lastSucceeded
                ? `Your editorial panel — developmental editor, character editor and reader — reads the full manuscript. It usually takes a few minutes. ${remaining}.`
                : "The report builds on your Story Bible and consistency check, so run an analysis first."
            }
            action={canGenerate ? <GenerateReportButton bookId={bookId} /> : undefined}
          />
        )}
      </div>
    );
  }

  const data = report.data as ReportData;
  const outdated = report.version_id !== book.current_version_id;
  const scores: [string, number][] = [
    ["Structure", data.assessment.structure],
    ["Character", data.assessment.character],
    ["Pacing", data.assessment.pacing],
    ["Clarity", data.assessment.clarity],
  ];

  return (
    <div className="print-page max-w-4xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {(reports ?? []).length > 1 &&
            (reports ?? []).map((r, i) => (
              <Link key={r.id} href={`/app/books/${bookId}/report?id=${r.id}`} className={clsx("rounded-md border px-3 py-1.5", r.id === report.id ? "border-ink" : "border-line text-muted")}>
                {i === 0 ? "Latest" : new Date(r.created_at).toLocaleDateString()}
              </Link>
            ))}
        </div>
        <div className="flex items-start gap-2">
          <PrintButton />
          {canGenerate && <GenerateReportButton bookId={bookId} label="New report" />}
        </div>
      </div>

      {activeReport && (
        <div className="no-print mb-6">
          <AnalysisProgress runId={activeReport.id} initial={activeReport} kind="report" />
        </div>
      )}
      {outdated && <p className="no-print mb-6 rounded-md bg-gold-soft px-4 py-3 text-sm">This report is for an earlier version of your manuscript. Generate a new one to include your revisions.</p>}

      <header className="border-b border-line pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Manuscript editorial report</p>
        <h1 className="mt-3 font-serif text-4xl">{book.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {[book.genre, `${report.chapters_covered} chapters reviewed`, new Date(report.created_at).toLocaleDateString(undefined, { dateStyle: "long" })].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-6 text-[17px] leading-relaxed">{data.overview}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {scores.map(([label, v]) => (
            <div key={label} className="print-avoid-break">
              <p className="font-serif text-3xl">
                {v}
                <span className="text-base text-muted">/10</span>
              </p>
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{data.assessment.rationale}</p>
      </header>

      <Section title="Priority revisions">
        <ol className="space-y-5">
          {data.priorities.map((p, i) => (
            <li key={i} className="print-avoid-break">
              <Card className="p-6">
                <p className="font-serif text-xl">
                  <span className="mr-2 text-burgundy">{i + 1}.</span>
                  {p.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{p.detail}</p>
                <p className="mt-3 text-sm text-muted">
                  <span className="font-medium text-ink">Why it matters: </span>
                  {p.why_it_matters}
                </p>
                <p className="mt-2 rounded-md bg-sage-soft/60 p-3 text-sm text-muted">
                  <span className="font-medium text-ink">Approach: </span>
                  {p.suggestion}
                </p>
                <Evidence bookId={bookId} items={p.evidence} />
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Strengths to protect">
        <div className="grid gap-4 md:grid-cols-2">
          {data.strengths.map((s, i) => (
            <Card key={i} className="print-avoid-break p-5">
              <p className="font-medium">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.detail}</p>
              <Evidence bookId={bookId} items={s.evidence} />
            </Card>
          ))}
        </div>
      </Section>

      <Section title={data.kind === "fiction" ? "Story structure" : "Argument structure"}>
        <p className="mb-4 text-sm text-muted">There is no single correct structure — this shows where the familiar beats land in your book, so you can decide what to strengthen.</p>
        <Card className="divide-y divide-line">
          {data.structure.map((b, i) => (
            <div key={i} className="print-avoid-break grid gap-2 px-5 py-4 text-sm sm:grid-cols-[180px_90px_1fr] sm:items-baseline">
              <p className="font-medium">{b.beat}</p>
              <p className="flex items-center gap-2">
                <span className={clsx("rounded px-2 py-0.5 text-xs font-medium capitalize", BEAT_STYLE[b.status])}>{b.status}</span>
              </p>
              <p className="text-muted">
                {b.chapter !== null && (
                  <Link href={`/app/books/${bookId}/manuscript?ch=${b.chapter - 1}`} className="mr-2 text-burgundy hover:underline">
                    Ch {b.chapter}
                  </Link>
                )}
                {b.note}
              </p>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Characters">
        <div className="space-y-3">
          {data.characters.map((c, i) => (
            <div key={i} className="print-avoid-break text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="mt-0.5 leading-relaxed text-muted">{c.note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The reader's experience">
        <Card className="divide-y divide-line">
          {data.reader_experience.map((r, i) => (
            <div key={i} className="print-avoid-break grid gap-1 px-5 py-3.5 text-sm sm:grid-cols-[110px_100px_1fr]">
              <p className="font-medium">Ch {r.chapters}</p>
              <p className={clsx("capitalize", REACTION_STYLE[r.reaction])}>{r.reaction}</p>
              <p className="text-muted">{r.note}</p>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Recommended revision order">
        <ol className="space-y-4">
          {data.revision_plan.map((s, i) => (
            <li key={i} className="print-avoid-break flex gap-4">
              <span className="font-serif text-2xl text-gold">{i + 1}</span>
              <div>
                <p className="font-medium">{s.step}</p>
                <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <p className="mt-12 border-t border-line pt-6 text-xs text-muted">
        Generated by Verse from your manuscript. Recommendations are editorial judgments for you to weigh — every creative decision is yours.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-5 font-serif text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Evidence({ bookId, items }: { bookId: string; items: { chapter: number; paragraph: number; quote: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {items.slice(0, 3).map((e, i) => (
        <Link key={i} href={passageHref(bookId, e.chapter - 1, e.paragraph)} className="block rounded-md border-l-2 border-gold bg-paper/70 px-3 py-2 hover:bg-paper">
          <span className="text-xs font-medium text-muted">Chapter {e.chapter}</span>
          <span className="mt-0.5 block font-serif text-sm">“{e.quote}”</span>
        </Link>
      ))}
    </div>
  );
}
