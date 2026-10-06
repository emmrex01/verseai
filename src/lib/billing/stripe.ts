import Stripe from "stripe";
import { env } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  stripe ??= new Stripe(env.stripeSecretKey());
  return stripe;
}

/** Map a Stripe price id back to a plan, using the configured env price ids. */
export function planForPrice(priceId: string | undefined): PlanId {
  if (!priceId) return "free";
  for (const plan of ["author", "pro", "studio"] as const) {
    for (const interval of ["month", "year"] as const) {
      try {
        if (env.stripePrice(plan, interval) === priceId) return plan;
      } catch {
        // price not configured
      }
    }
  }
  return "free";
}
