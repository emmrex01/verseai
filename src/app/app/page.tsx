import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getAllowance } from "@/lib/billing/usage";
import { ButtonLink, Card, EmptyState, Meter, SeverityBadge, type Severity } from "@/components/ui";

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const { supabase, user } = await requireUser();
  const { deleted } = await searchParams;

  const { data: profile } = await supabase.from("profiles").select("display_name, onboarded_at").eq("id", user.id).maybeSingle();
  if (!profile?.onboarded_at) redirect("/app/welcome");

  const [{ data: books }, { data: issues }, { data: runs }, allowance] = await Promise.all([
    supabase.from("books").select("id, title, genre, kind, current_version_id, updated_at, manuscript_versions!books_current_version_fk(word_count, chapter_count)").order("updated_at", { ascending: false }),
    supabase.from("issues").select("id, book_id, title, severity, category").eq("status", "open"),
    supabase.from("analysis_runs").select("book_id, status, stage, progress, created_at").order("created_at", { ascending: false }).limit(50),
    getAllowance(supabase, user.id),
  ]);

  const nextUp = [...(issues ?? [])].sort((a, b) => SEVERITY_RANK[a.severity as Severity] - SEVERITY_RANK[b.severity as Severity]).slice(0, 5);
  const bookTitle = new Map((books ?? []).map((b) => [b.id, b.title]));
  const name = profile.display_name?.split(" ")[0];
  const atBookLimit = allowance.plan.books !== null && (books?.length ?? 0) >= allowance.plan.books;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {deleted && <p className="mb-6 rounded-md bg-sage-soft px-4 py-3 text-sm text-sage">The book and all of its data were permanently deleted.</p>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl">{name ? `Welcome back, ${name}.` : "Welcome back."}</h1>
          <p className="mt-1 text-sm text-muted">{nextUp.length ? "Here's what deserves your attention next." : "Pick up where you left off."}</p>
        </div>
        <ButtonLink href={atBookLimit ? "/app/billing" : "/app/books/new"} variant={atBookLimit ? "secondary" : "primary"}>
          <Plus className="h-4 w-4" aria-hidden /> {atBookLimit ? "Upgrade for more books" : "New book"}
        </ButtonLink>
      </div>

      {!books?.length ? (
        <div className="mt-10">
          <EmptyState
            title="Start with your manuscript"
            description="Create a book and upload a DOCX, PDF or text file. Verse will build your Story Bible and check it for consistency in a few minutes."
            action={<ButtonLink href="/app/books/new">Create your first book</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {nextUp.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Needs attention</h2>
                <Card className="divide-y divide-line">
                  {nextUp.map((i) => (
                    <Link key={i.id} href={`/app/books/${i.book_id}/issues#${i.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-paper/60">
                      <div className="flex min-w-0 items-center gap-3">
                        <SeverityBadge severity={i.severity as Severity} />
                        <span className="truncate text-sm">{i.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{bookTitle.get(i.book_id)}</span>
                    </Link>
                  ))}
                </Card>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Your books</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {books.map((b) => {
                  const version = Array.isArray(b.manuscript_versions) ? b.manuscript_versions[0] : b.manuscript_versions;
                  const run = runs?.find((r) => r.book_id === b.id);
                  const open = (issues ?? []).filter((i) => i.book_id === b.id);
                  return (
                    <Link key={b.id} href={`/app/books/${b.id}`} className="group">
                      <Card className="h-full p-5 transition-colors group-hover:border-ink/40">
                        <p className="font-serif text-xl">{b.title}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {[b.genre, version ? `${version.word_count.toLocaleString()} words` : "No manuscript yet"].filter(Boolean).join(" · ")}
                        </p>
                        <div className="mt-5 flex items-center justify-between text-sm">
                          {run && (run.status === "queued" || run.status === "running") ? (
                            <span className="text-gold">{run.stage}…</span>
                          ) : open.length ? (
                            <span className="text-muted">
                              {open.length} open {open.length === 1 ? "issue" : "issues"}
                            </span>
                          ) : version ? (
                            <span className="text-sage">{run?.status === "succeeded" ? "No open issues" : "Ready to analyze"}</span>
                          ) : (
                            <span className="text-muted">Upload a manuscript</span>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>

          <aside>
            <Card className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{allowance.plan.name} plan</p>
                <Link href="/app/billing" className="text-xs text-muted underline">
                  Manage
                </Link>
              </div>
              <Meter label="Words analyzed this month" value={allowance.wordsUsed} max={allowance.plan.monthlyAnalysisWords} />
              <Meter label="Questions this month" value={allowance.questionsUsed} max={allowance.plan.monthlyQuestions} />
              {allowance.plan.id === "free" && (
                <ButtonLink href="/app/billing" variant="accent" className="w-full">
                  Unlock your full manuscript
                </ButtonLink>
              )}
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
