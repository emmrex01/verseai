import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]">) {
  const { runId } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("analysis_runs")
    .select("id, status, stage, progress, error, chapters_reused, words_billed")
    .eq("id", runId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
