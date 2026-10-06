import { Check } from "lucide-react";
import { clsx } from "clsx";
import { PLANS, type PlanId } from "@/lib/plans";
import { ButtonLink } from "@/components/ui";

const ORDER: PlanId[] = ["free", "author", "pro", "studio"];

export function PricingTable() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {ORDER.map((id) => {
        const plan = PLANS[id];
        const featured = id === "pro";
        return (
          <div key={id} className={clsx("flex flex-col rounded-lg border bg-white p-6", featured ? "border-ink shadow-[0_1px_0_0_#171717]" : "border-line")}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl">{plan.name}</h3>
              {featured && <span className="rounded bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-ivory">Most popular</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
            <p className="mt-6">
              <span className="font-serif text-4xl">${plan.monthly}</span>
              <span className="text-sm text-muted"> / month</span>
            </p>
            <p className="mt-1 h-4 text-xs text-muted">{plan.yearly > 0 ? `or $${plan.yearly}/year — two months free` : "No card required"}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href={id === "free" ? "/signup" : `/signup?plan=${id}`} variant={featured ? "primary" : "secondary"} className="mt-8 w-full">
              {id === "free" ? "Start free" : `Choose ${plan.name}`}
            </ButtonLink>
          </div>
        );
      })}
    </div>
  );
}
