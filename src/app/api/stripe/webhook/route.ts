import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, planForPrice } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

/** Stripe is the source of truth for plans; this keeps `subscriptions` in sync. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, env.stripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    const item = sub.items.data[0];
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const ended = event.type === "customer.subscription.deleted" || ["canceled", "incomplete_expired", "unpaid"].includes(sub.status);
    const admin = createAdminClient();

    const row = {
      plan: ended ? "free" : planForPrice(item?.price.id),
      status: ended ? "canceled" : sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: ended ? null : sub.id,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    const userId = sub.metadata?.user_id;
    const query = userId
      ? admin.from("subscriptions").upsert({ owner_id: userId, ...row })
      : admin.from("subscriptions").update(row).eq("stripe_customer_id", customerId);
    const { error } = await query;
    if (error) {
      console.error("subscription sync failed", error);
      return NextResponse.json({ error: "sync failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
