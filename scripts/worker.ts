/**
 * Analysis worker. Run alongside the web app: `npm run worker`.
 * Claims queued analysis runs from Postgres (SKIP LOCKED), so several workers
 * can run in parallel safely. Crashed runs are reclaimed after 20 minutes.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

const IDLE_MS = 3000;
let stopping = false;
process.on("SIGTERM", () => (stopping = true));
process.on("SIGINT", () => (stopping = true));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Imported after env is loaded: model config is read at module load.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { runAnalysis } = await import("@/lib/analysis/pipeline");
  const { AIError } = await import("@/lib/ai/client");
  const db = createAdminClient();
  console.log("[worker] started");
  while (!stopping) {
    const { data, error } = await db.rpc("claim_analysis_run");
    if (error) {
      console.error("[worker] claim failed:", error.message);
      await sleep(IDLE_MS * 3);
      continue;
    }
    const run = Array.isArray(data) ? data[0] : null;
    if (!run) {
      await sleep(IDLE_MS);
      continue;
    }
    const started = Date.now();
    console.log(`[worker] run ${run.id} (book ${run.book_id}) attempt ${run.attempts}`);
    try {
      await runAnalysis(db, run);
      console.log(`[worker] run ${run.id} done in ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (err) {
      const message = err instanceof AIError ? err.message : "Analysis failed unexpectedly. Please try again.";
      console.error(`[worker] run ${run.id} failed:`, err);
      await db
        .from("analysis_runs")
        .update({ status: "failed", stage: "Failed", error: message, finished_at: new Date().toISOString() })
        .eq("id", run.id);
    }
  }
  console.log("[worker] stopped");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
