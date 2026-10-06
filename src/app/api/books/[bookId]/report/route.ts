import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueReport } from "@/lib/analysis/queue";

export async function POST(_request: Request, ctx: RouteContext<"/api/books/[bookId]/report">) {
  const { bookId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const result = await queueReport(supabase, createAdminClient(), auth.user.id, bookId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "no_manuscript" ? 404 : result.reason === "quota" ? 402 : 409 });
}
