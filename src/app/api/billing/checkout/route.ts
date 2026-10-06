import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

const Body = z.object({ plan: z.enum(["author", "pro", "studio"]), interval: z.enum(["month", "year"]).default("month") });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

  const stripe = getStripe();
  const admin = createAdminClient();
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("owner_id", auth.user.id).maybeSingle();

  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: auth.user.email, metadata: { user_id: auth.user.id } });
    customerId = customer.id;
    await admin.from("subscriptions").upsert({ owner_id: auth.user.id, stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: auth.user.id,
    line_items: [{ price: env.stripePrice(parsed.data.plan, parsed.data.interval), quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: auth.user.id } },
    success_url: `${env.siteUrl()}/app/billing?status=success`,
    cancel_url: `${env.siteUrl()}/app/billing?status=cancelled`,
  });
  return NextResponse.json({ url: session.url });
}
