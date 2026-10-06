/**
 * Accuracy eval: runs the full analysis prompts on every manuscript in
 * eval/fixtures/ that has a matching .expected.json, then reports recall,
 * precision, false positives and cost. Calls the Anthropic API (costs money).
 *
 *   npm run eval                 # all fixtures
 *   npm run eval -- last-winter  # fixtures whose name contains "last-winter"
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { blocksFromText } = await import("@/lib/manuscript/parse");
  const { structureManuscript } = await import("@/lib/manuscript/structure");
  const { analyzeInMemory } = await import("@/lib/analysis/quick-check");
  const { scoreIssues } = await import("@/lib/eval/score");
  const { MODELS } = await import("@/lib/ai/client");

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY in .env.local to run the eval.");

  const dir = path.join(process.cwd(), "eval/fixtures");
  const filter = process.argv[2];
  const fixtures = fs
    .readdirSync(dir)
    .filter((f) => /\.(md|txt)$/.test(f) && (!filter || f.includes(filter)))
    .filter((f) => fs.existsSync(path.join(dir, f.replace(/\.(md|txt)$/, ".expected.json"))));
  if (!fixtures.length) throw new Error("No fixtures found.");

  console.log(`Models: fast=${MODELS.fast} reasoning=${MODELS.reasoning}\n`);
  const rows = [];
  for (const file of fixtures) {
    const spec = JSON.parse(fs.readFileSync(path.join(dir, file.replace(/\.(md|txt)$/, ".expected.json")), "utf8"));
    const manuscript = structureManuscript(blocksFromText(fs.readFileSync(path.join(dir, file), "utf8")));
    const started = Date.now();
    const result = await analyzeInMemory(manuscript, {
      book: { title: spec.title, genre: spec.genre, kind: "fiction" },
      resolveEntities: true,
      fullChecks: true,
    });
    // Pacing notes are recommendations, not consistency claims; score only consistency/plot issues.
    const scored = result.issues.filter((i) => i.category !== "pacing");
    const score = scoreIssues(scored, spec);
    const seconds = Math.round((Date.now() - started) / 1000);

    console.log(`== ${file} (${manuscript.wordCount.toLocaleString()} words, ${manuscript.chapters.length} chapters, ${seconds}s)`);
    console.log(`   recall ${(score.recall * 100).toFixed(0)}%  precision ${(score.precisionLow * 100).toFixed(0)}–${(score.precisionHigh * 100).toFixed(0)}%  cost $${result.usage.costUsd.toFixed(3)}`);
    console.log(`   found:    ${score.found.join(", ") || "—"}`);
    console.log(`   missed:   ${score.missed.join(", ") || "—"}`);
    if (score.optionalFound.length) console.log(`   optional: ${score.optionalFound.join(", ")}`);
    for (const d of score.decoyHits) console.log(`   FALSE POSITIVE (decoy ${d.decoy}): ${d.issue}`);
    for (const u of score.unmatched) console.log(`   review by hand: ${u}`);
    console.log(`   story bible: ${result.stats.characters} characters, ${result.stats.locations} places, ${result.stats.events} events\n`);

    rows.push({ file, words: manuscript.wordCount, seconds, costUsd: result.usage.costUsd, ...score, issues: result.issues });
  }

  const out = path.join(process.cwd(), "eval/results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ models: MODELS, rows }, null, 2));

  const words = rows.reduce((n, r) => n + r.words, 0);
  const cost = rows.reduce((n, r) => n + r.costUsd, 0);
  const recall = rows.reduce((n, r) => n + r.recall, 0) / rows.length;
  console.log(`TOTAL  recall ${(recall * 100).toFixed(0)}%  cost $${cost.toFixed(3)}  ≈ $${((cost / words) * 100_000).toFixed(2)} per 100k words`);
  console.log(`Full results: ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
