import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, type Plan } from "@/lib/plans";

export function startOfMonthUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getUserPlan(db: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await db.from("subscriptions").select("plan, status").eq("owner_id", userId).maybeSingle();
  const active = data && ["active", "trialing", "past_due"].includes(data.status);
  return getPlan(active ? data.plan : "free");
}

export async function monthlyUsage(db: SupabaseClient, userId: string, kind: "analysis_words" | "question"): Promise<number> {
  const { data } = await db
    .from("usage_events")
    .select("quantity")
    .eq("owner_id", userId)
    .eq("kind", kind)
    .gte("created_at", startOfMonthUtc());
  return (data ?? []).reduce((n, r) => n + (r.quantity ?? 0), 0);
}

export interface Allowance {
  plan: Plan;
  wordsUsed: number;
  wordsRemaining: number;
  questionsUsed: number;
  questionsRemaining: number;
}

export async function getAllowance(db: SupabaseClient, userId: string): Promise<Allowance> {
  const [plan, wordsUsed, questionsUsed] = await Promise.all([
    getUserPlan(db, userId),
    monthlyUsage(db, userId, "analysis_words"),
    monthlyUsage(db, userId, "question"),
  ]);
  return {
    plan,
    wordsUsed,
    wordsRemaining: Math.max(0, plan.monthlyAnalysisWords - wordsUsed),
    questionsUsed,
    questionsRemaining: Math.max(0, plan.monthlyQuestions - questionsUsed),
  };
}

/** Words a new analysis would bill: chapters without a cached extraction. */
export async function wordsToAnalyze(
  admin: SupabaseClient,
  bookId: string,
  chapters: { content_hash: string; word_count: number }[],
  pipelineVersion: number,
): Promise<number> {
  if (chapters.length === 0) return 0;
  const { data } = await admin
    .from("chapter_extractions")
    .select("content_hash")
    .eq("book_id", bookId)
    .eq("pipeline_version", pipelineVersion)
    .in("content_hash", chapters.map((c) => c.content_hash));
  const cached = new Set((data ?? []).map((d) => d.content_hash));
  return chapters.filter((c) => !cached.has(c.content_hash)).reduce((n, c) => n + c.word_count, 0);
}
