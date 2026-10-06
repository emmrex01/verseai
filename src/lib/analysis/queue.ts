import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllowance, wordsToAnalyze, type Allowance } from "@/lib/billing/usage";
import { PIPELINE_VERSION } from "./extract";

const QUEUE_PRIORITY = { free: 0, author: 1, pro: 2, studio: 2 } as const;

export type QueueResult =
  | { ok: true; runId: string; billableWords: number; partial: null | { chapters: number; words: number } }
  | { ok: false; reason: "quota" | "too_large" | "in_progress" | "no_manuscript" | "not_analyzed"; message: string; billableWords?: number };

type Failure = Extract<QueueResult, { ok: false }>;

interface Prepared {
  versionId: string;
  allowance: Allowance;
  included: { idx: number; content_hash: string; word_count: number }[];
  chapterLimit: number | null;
}

/**
 * Shared checks for any job on a book: ownership, one job at a time, and the
 * plan's manuscript size. Books larger than the plan allows are processed from
 * the start up to the limit, so every author sees real results before upgrading.
 */
async function prepare(db: SupabaseClient, admin: SupabaseClient, userId: string, bookId: string): Promise<Prepared | Failure> {
  const { data: book } = await admin.from("books").select("current_version_id, owner_id").eq("id", bookId).single();
  if (!book?.current_version_id || book.owner_id !== userId) {
    return { ok: false, reason: "no_manuscript", message: "Upload a manuscript first." };
  }

  const { data: active } = await admin.from("analysis_runs").select("id").eq("book_id", bookId).in("status", ["queued", "running"]).limit(1);
  if (active?.length) return { ok: false, reason: "in_progress", message: "Verse is already working on this book. Try again when it finishes." };

  const { data: chapterRows } = await admin.from("chapters").select("idx, content_hash, word_count").eq("version_id", book.current_version_id).order("idx");
  const all = chapterRows ?? [];
  const allowance = await getAllowance(db, userId);

  let included = all;
  let chapterLimit: number | null = null;
  if (all.reduce((n, c) => n + c.word_count, 0) > allowance.plan.maxManuscriptWords) {
    let words = 0;
    included = [];
    for (const c of all) {
      if (words + c.word_count > allowance.plan.maxManuscriptWords) break;
      included.push(c);
      words += c.word_count;
    }
    if (included.length === 0) {
      return { ok: false, reason: "too_large", message: `Your first chapter is longer than the ${allowance.plan.maxManuscriptWords.toLocaleString()} words the ${allowance.plan.name} plan covers.` };
    }
    chapterLimit = included[included.length - 1].idx;
  }
  return { versionId: book.current_version_id, allowance, included, chapterLimit };
}

async function insertRun(admin: SupabaseClient, userId: string, bookId: string, p: Prepared, kind: "analysis" | "report") {
  const { data: run, error } = await admin
    .from("analysis_runs")
    .insert({ book_id: bookId, version_id: p.versionId, owner_id: userId, kind, priority: QUEUE_PRIORITY[p.allowance.plan.id], chapter_limit: p.chapterLimit })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return run.id as string;
}

const partialOf = (p: Prepared) => (p.chapterLimit === null ? null : { chapters: p.included.length, words: p.included.reduce((n, c) => n + c.word_count, 0) });

/** Queue an analysis of the book's current manuscript version. */
export async function queueAnalysis(db: SupabaseClient, admin: SupabaseClient, userId: string, bookId: string): Promise<QueueResult> {
  const p = await prepare(db, admin, userId, bookId);
  if ("ok" in p) return p;

  const billableWords = await wordsToAnalyze(admin, bookId, p.included, PIPELINE_VERSION);
  if (billableWords > p.allowance.wordsRemaining) {
    return {
      ok: false,
      reason: "quota",
      billableWords,
      message: `This analysis needs ${billableWords.toLocaleString()} words of new analysis, and you have ${p.allowance.wordsRemaining.toLocaleString()} left this month on the ${p.allowance.plan.name} plan.`,
    };
  }
  return { ok: true, runId: await insertRun(admin, userId, bookId, p, "analysis"), billableWords, partial: partialOf(p) };
}

/** Queue an editorial report. Requires a finished analysis of the current version. */
export async function queueReport(db: SupabaseClient, admin: SupabaseClient, userId: string, bookId: string): Promise<QueueResult> {
  const p = await prepare(db, admin, userId, bookId);
  if ("ok" in p) return p;

  const { data: analyzed } = await admin
    .from("analysis_runs")
    .select("id")
    .eq("book_id", bookId)
    .eq("version_id", p.versionId)
    .eq("kind", "analysis")
    .eq("status", "succeeded")
    .limit(1);
  if (!analyzed?.length) {
    return { ok: false, reason: "not_analyzed", message: "Analyze this version first — the report builds on your Story Bible and consistency check." };
  }
  if (p.allowance.reportsRemaining <= 0) {
    return { ok: false, reason: "quota", message: `You've used all ${p.allowance.plan.monthlyReports} editorial reports on the ${p.allowance.plan.name} plan this month.` };
  }
  return { ok: true, runId: await insertRun(admin, userId, bookId, p, "report"), billableWords: 0, partial: partialOf(p) };
}
