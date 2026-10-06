import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { PLANS, type PlanId } from "@/lib/plans";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Metrics {
  users: number;
  signups_7d: number;
  signups_30d: number;
  funnel: Record<string, number>;
  plans: Partial<Record<PlanId, number>>;
  cancelling: number;
  ai_cost_30d: Record<string, number>;
  free_tool_cost_30d: number;
  free_tool_runs_30d: number;
  words_analyzed_30d: number;
  jobs: { queued: number; running: number; succeeded_7d: number; failed_7d: number; avg_minutes_7d: number | null };
  failed_runs: { id: string; kind: string; error: string | null; attempts: number; created_at: string; title: string }[];
  recent_users: { display_name: string | null; writing_type: string | null; writing_stage: string | null; created_at: string; plan: string | null; books: number }[];
}

const FUNNEL: [string, string][] = [
  ["signed_up", "Signed up"],
  ["onboarded", "Onboarded"],
  ["created_book", "Created a book"],
  ["uploaded", "Uploaded a manuscript"],
  ["analyzed", "Completed an analysis"],
  ["asked", "Asked a question"],
  ["reported", "Generated a report"],
  ["paid", "Paying"],
];

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function AdminPage() {
  const { user } = await requireUser();
  if (!user.email || !env.adminEmails().includes(user.email.toLowerCase())) notFound();

  const { data, error } = await createAdminClient().rpc("admin_metrics");
  if (error) throw new Error(error.message);
  const m = data as Metrics;

  // Estimate: assumes monthly billing; yearly subscribers pay ~17% less per month.
  const mrr = (Object.entries(m.plans) as [PlanId, number][]).reduce((n, [plan, count]) => n + (PLANS[plan]?.monthly ?? 0) * count, 0);
  const aiCost = Object.values(m.ai_cost_30d).reduce((a, b) => a + Number(b), 0) + Number(m.free_tool_cost_30d);
  const paid = m.funnel.paid ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader title="Admin" description="Live from the database. Revenue is an estimate from active plans; Stripe is the source of truth." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Users" value={m.users.toLocaleString()} sub={`+${m.signups_7d} this week · +${m.signups_30d} in 30d`} />
        <Kpi label="Paying" value={paid.toLocaleString()} sub={`${m.users ? ((paid / m.users) * 100).toFixed(1) : "0"}% conversion · ${m.cancelling} cancelling`} />
        <Kpi label="Est. MRR" value={usd(mrr)} sub={paid ? `${usd(mrr / paid)} per paying user` : "—"} />
        <Kpi label="AI cost, 30d" value={usd(aiCost)} sub={mrr ? `${((aiCost / mrr) * 100).toFixed(0)}% of MRR` : `${m.words_analyzed_30d.toLocaleString()} words analyzed`} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-serif text-xl">Activation funnel</h2>
          <p className="mt-1 text-xs text-muted">The aha moment is “Completed an analysis”. Everything before it is onboarding friction.</p>
          <div className="mt-5 space-y-2.5">
            {FUNNEL.map(([key, label]) => {
              const n = m.funnel[key] ?? 0;
              const pct = m.funnel.signed_up ? (n / m.funnel.signed_up) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted">
                      {n.toLocaleString()} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-paper">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-serif text-xl">Plans</h2>
            <div className="mt-4 grid grid-cols-4 gap-3 text-center">
              {(["free", "author", "pro", "studio"] as PlanId[]).map((p) => (
                <div key={p}>
                  <p className="font-serif text-2xl">{m.plans[p] ?? 0}</p>
                  <p className="text-xs text-muted">{PLANS[p].name}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-serif text-xl">AI cost by feature, 30 days</h2>
            <dl className="mt-4 space-y-2 text-sm">
              {[...Object.entries(m.ai_cost_30d), ["free checker", m.free_tool_cost_30d] as [string, number]].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="capitalize text-muted">{k.replace("_", " ")}</dt>
                  <dd>{usd(Number(v))}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">{m.free_tool_runs_30d.toLocaleString()} free-checker runs in 30 days.</p>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-serif text-xl">Jobs</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <Stat label="Queued" value={m.jobs.queued} />
          <Stat label="Running" value={m.jobs.running} />
          <Stat label="Succeeded (7d)" value={m.jobs.succeeded_7d} />
          <Stat label="Failed (7d)" value={m.jobs.failed_7d} />
          <Stat label="Avg minutes (7d)" value={m.jobs.avg_minutes_7d ?? "—"} />
        </div>
        {m.failed_runs.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Book</th>
                  <th className="py-2 font-medium">Kind</th>
                  <th className="py-2 font-medium">Attempts</th>
                  <th className="py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.failed_runs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 text-muted">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2">{r.title}</td>
                    <td className="py-2">{r.kind}</td>
                    <td className="py-2">{r.attempts}</td>
                    <td className="py-2 text-critical">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">Full stack traces are in the worker logs.</p>
          </div>
        )}
      </Card>

      <Card className="mt-6 overflow-x-auto p-6">
        <h2 className="font-serif text-xl">Recent signups</h2>
        <table className="mt-4 w-full min-w-[560px] text-sm">
          <tbody className="divide-y divide-line">
            {m.recent_users.map((u, i) => (
              <tr key={i}>
                <td className="py-2">{u.display_name ?? "—"}</td>
                <td className="py-2 capitalize text-muted">{[u.writing_type, u.writing_stage?.replace("_", " ")].filter(Boolean).join(" · ") || "not onboarded"}</td>
                <td className="py-2 text-muted">{u.books} books</td>
                <td className="py-2 capitalize">{u.plan ?? "free"}</td>
                <td className="py-2 text-right text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="font-serif text-2xl">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
