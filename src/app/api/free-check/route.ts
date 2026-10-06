import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { ManuscriptParseError, extensionOf, parseManuscript } from "@/lib/manuscript/parse";
import { structureManuscript, type SourceBlock } from "@/lib/manuscript/structure";
import { quickCheck } from "@/lib/analysis/quick-check";

export const maxDuration = 300;

const FREE_WORD_LIMIT = 12_000;
const RUNS_PER_IP_PER_DAY = 2;

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Free Plot Hole & Consistency Checker. No account required, so it is capped:
 * first 12,000 words, 2 runs per IP per day, and a global daily spend budget.
 * Returns counts for everything but full detail for only the top issue.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  const ipHash = createHash("sha256").update(env.ipHashSalt() + clientIp(request)).digest("hex");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ count: ipRuns }, { data: spend }] = await Promise.all([
    admin.from("free_tool_runs").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
    admin.from("free_tool_runs").select("cost_usd").gte("created_at", since),
  ]);
  if ((ipRuns ?? 0) >= RUNS_PER_IP_PER_DAY) {
    return NextResponse.json({ error: "You've used today's free checks. Create a free Verse account to analyze your full manuscript." }, { status: 429 });
  }
  const spent = (spend ?? []).reduce((n, r) => n + Number(r.cost_usd), 0);
  if (spent >= env.freeToolDailyBudgetUsd()) {
    return NextResponse.json({ error: "The free checker is at capacity today. Create a free account to analyze your manuscript now." }, { status: 503 });
  }

  let blocks: SourceBlock[];
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File) || !extensionOf(file.name)) {
        return NextResponse.json({ error: "Upload a .docx, .pdf, .txt or .md file." }, { status: 400 });
      }
      blocks = await parseManuscript(Buffer.from(await file.arrayBuffer()), file.name);
    } else {
      const body = await request.json().catch(() => ({}));
      const text = typeof body.text === "string" ? body.text : "";
      blocks = await parseManuscript(Buffer.from(text, "utf8"), "pasted.txt");
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof ManuscriptParseError ? err.message : "We couldn't read that file." }, { status: 422 });
  }

  // Truncate to the free limit at a paragraph boundary.
  let words = 0;
  const limited: SourceBlock[] = [];
  for (const b of blocks) {
    const w = b.text.split(/\s+/).length;
    if (words + w > FREE_WORD_LIMIT) break;
    limited.push(b);
    words += w;
  }
  const manuscript = structureManuscript(limited);
  if (manuscript.wordCount < 1500) {
    return NextResponse.json({ error: "Paste or upload at least 1,500 words — consistency problems show up across chapters." }, { status: 422 });
  }

  try {
    const { issues, stats, usage } = await quickCheck(manuscript);
    await admin.from("free_tool_runs").insert({ ip_hash: ipHash, words: manuscript.wordCount, cost_usd: usage.costUsd });
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    issues.forEach((i) => counts[i.severity]++);
    return NextResponse.json({
      wordsAnalyzed: manuscript.wordCount,
      truncated: limited.length < blocks.length,
      stats,
      counts,
      preview: issues[0] ? { ...issues[0], chapterTitles: issues[0].evidence.map((e) => manuscript.chapters[e.chapter_idx]?.title) } : null,
      lockedTitles: issues.slice(1, 8).map((i) => ({ severity: i.severity, category: i.category })),
    });
  } catch (err) {
    console.error("free check failed", err);
    return NextResponse.json({ error: "The check failed. Please try again in a minute." }, { status: 502 });
  }
}
