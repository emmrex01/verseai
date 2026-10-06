import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("owner_id", auth.user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "No billing account yet." }, { status: 400 });
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.siteUrl()}/app/billing`,
  });
  return NextResponse.json({ url: session.url });
}
