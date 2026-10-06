import { Check } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { getAllowance } from "@/lib/billing/usage";
import { PAID_PLANS, PLANS } from "@/lib/plans";
import { CheckoutButton, PortalButton } from "@/components/billing-buttons";
import { Card, Meter, PageHeader } from "@/components/ui";

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const { status, plan: wanted } = await searchParams;
  const { supabase, user } = await requireUser();
  const [allowance, { data: sub }] = await Promise.all([
    getAllowance(supabase, user.id),
    supabase.from("subscriptions").select("plan, status, current_period_end, cancel_at_period_end, stripe_customer_id").eq("owner_id", user.id).maybeSingle(),
  ]);
  const current = allowance.plan;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader title="Plan & usage" description="Allowances reset on the first of each month. Re-analyzing unchanged chapters never counts." actions={sub?.stripe_customer_id ? <PortalButton /> : undefined} />

      {status === "success" && <p className="mb-6 rounded-md bg-sage-soft px-4 py-3 text-sm text-sage">Thank you — your plan is being activated. It can take a few seconds to appear.</p>}
      {typeof wanted === "string" && wanted in PLANS && wanted !== current.id && status !== "success" && (
        <p className="mb-6 rounded-md bg-gold-soft px-4 py-3 text-sm">Complete your upgrade to {PLANS[wanted as keyof typeof PLANS].name} below.</p>
      )}

      <Card className="grid gap-6 p-6 md:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Current plan</p>
          <p className="mt-1 font-serif text-3xl">{current.name}</p>
          {sub?.current_period_end && current.id !== "free" && (
            <p className="mt-1 text-sm text-muted">
              {sub.cancel_at_period_end ? "Ends" : "Renews"} {new Date(sub.current_period_end).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="space-y-4">
          <Meter label="Words analyzed this month" value={allowance.wordsUsed} max={current.monthlyAnalysisWords} />
          <Meter label="Ask Your Book questions" value={allowance.questionsUsed} max={current.monthlyQuestions} />
          <Meter label="Editorial reports" value={allowance.reportsUsed} max={current.monthlyReports} />
          <p className="text-xs text-muted">
            Books: {current.books === null ? "unlimited" : current.books} · Largest manuscript: {current.maxManuscriptWords.toLocaleString()} words
          </p>
        </div>
      </Card>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current.id;
          return (
            <Card key={id} className={`flex flex-col p-6 ${wanted === id ? "border-ink" : ""}`}>
              <p className="font-serif text-xl">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.tagline}</p>
              <p className="mt-4">
                <span className="font-serif text-3xl">${p.monthly}</span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-2">
                {isCurrent ? (
                  <p className="rounded-md bg-paper py-2.5 text-center text-sm text-muted">Your current plan</p>
                ) : current.id !== "free" ? (
                  <PortalButton />
                ) : (
                  <>
                    <CheckoutButton plan={id} interval="month" label={`Choose ${p.name} — monthly`} variant={id === "pro" ? "primary" : "secondary"} />
                    <CheckoutButton plan={id} interval="year" label={`Yearly — $${p.yearly}`} variant="secondary" />
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
