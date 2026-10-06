import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllowance, wordsToAnalyze } from "@/lib/billing/usage";
import { PIPELINE_VERSION } from "./extract";

const QUEUE_PRIORITY = { free: 0, author: 1, pro: 2, studio: 2 } as const;

export type QueueResult =
  | { ok: true; runId: string; billableWords: number; partial: null | { chapters: number; words: number } }
  | { ok: false; reason: "quota" | "too_large" | "in_progress" | "no_manuscript"; message: string; billableWords?: number };

/**
 * Queue an analysis of the book's current manuscript version, if the author's
 * plan allows it. `db` is the user's client (for allowance), `admin` writes.
 */
export async function queueAnalysis(db: SupabaseClient, admin: SupabaseClient, userId: string, bookId: string): Promise<QueueResult> {
  const { data: book } = await admin.from("books").select("current_version_id, owner_id").eq("id", bookId).single();
  if (!book?.current_version_id || book.owner_id !== userId) {
    return { ok: false, reason: "no_manuscript", message: "Upload a manuscript first." };
  }

  const { data: active } = await admin
    .from("analysis_runs")
    .select("id")
    .eq("book_id", bookId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (active?.length) return { ok: false, reason: "in_progress", message: "An analysis is already running for this book." };

  const { data: chapterRows } = await admin
    .from("chapters")
    .select("idx, content_hash, word_count")
    .eq("version_id", book.current_version_id)
    .order("idx");
  const allChapters = chapterRows ?? [];
  const allowance = await getAllowance(db, userId);

  // Books larger than the plan allows are analyzed from the start up to the
  // limit, so every author sees real results before deciding to upgrade.
  let included = allChapters;
  let chapterLimit: number | null = null;
  const totalWords = allChapters.reduce((n, c) => n + c.word_count, 0);
  if (totalWords > allowance.plan.maxManuscriptWords) {
    let words = 0;
    included = [];
    for (const c of allChapters) {
      if (words + c.word_count > allowance.plan.maxManuscriptWords) break;
      included.push(c);
      words += c.word_count;
    }
    if (included.length === 0) {
      return {
        ok: false,
        reason: "too_large",
        message: `Your first chapter is longer than the ${allowance.plan.maxManuscriptWords.toLocaleString()} words the ${allowance.plan.name} plan analyzes.`,
      };
    }
    chapterLimit = included[included.length - 1].idx;
  }

  const billableWords = await wordsToAnalyze(admin, bookId, included, PIPELINE_VERSION);
  if (billableWords > allowance.wordsRemaining) {
    return {
      ok: false,
      reason: "quota",
      billableWords,
      message: `This analysis needs ${billableWords.toLocaleString()} words of new analysis, and you have ${allowance.wordsRemaining.toLocaleString()} left this month on the ${allowance.plan.name} plan.`,
    };
  }

  const { data: run, error } = await admin
    .from("analysis_runs")
    .insert({ book_id: bookId, version_id: book.current_version_id, owner_id: userId, priority: QUEUE_PRIORITY[allowance.plan.id], chapter_limit: chapterLimit })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const partial = chapterLimit === null ? null : { chapters: included.length, words: included.reduce((n, c) => n + c.word_count, 0) };
  return { ok: true, runId: run.id, billableWords, partial };
}
