import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callStructured, type Usage } from "@/lib/ai/client";
import { locateQuote } from "./evidence";

const Cite = z.object({
  chapter: z.number().int().describe("Chapter number as labelled [Ch N · P#]."),
  paragraph: z.number().int(),
  quote: z.string().describe("Verbatim words from that paragraph, 5-30 words."),
});

const FICTION_BEATS = ["Opening", "Inciting incident", "Rising action", "Midpoint", "Crisis", "Climax", "Resolution"] as const;
const NONFICTION_BEATS = ["Problem", "Context", "Framework", "Evidence", "Application", "Conclusion"] as const;

const ReportSchema = z.object({
  overview: z.string().describe("3-5 sentences: what this manuscript is, what it does well, and the single most important thing to work on."),
  assessment: z.object({
    structure: z.number().int().describe("1-10"),
    character: z.number().int().describe("1-10"),
    pacing: z.number().int().describe("1-10"),
    clarity: z.number().int().describe("1-10"),
    rationale: z.string().describe("One or two sentences explaining these scores relative to published books in the genre."),
  }),
  structure: z.array(
    z.object({
      beat: z.string().describe("Beat name from the framework provided."),
      status: z.enum(["strong", "present", "weak", "missing"]).catch("present"),
      chapter: z.number().int().nullable().describe("Chapter where it lands, or null if missing."),
      note: z.string().describe("One or two sentences."),
    }),
  ),
  strengths: z.array(z.object({ title: z.string(), detail: z.string(), evidence: z.array(Cite) })),
  priorities: z.array(
    z.object({
      title: z.string(),
      detail: z.string().describe("What the problem is and where it shows up."),
      why_it_matters: z.string().describe("The effect on the reader."),
      suggestion: z.string().describe("A concrete revision approach. Do not rewrite the author's prose."),
      evidence: z.array(Cite),
    }),
  ),
  characters: z.array(z.object({ name: z.string(), note: z.string().describe("Motivation, consistency and arc — what works and what to strengthen.") })),
  reader_experience: z.array(
    z.object({
      chapters: z.string().describe("e.g. '1-3' or '14'"),
      reaction: z.enum(["hooked", "engaged", "confused", "slowing", "moved"]).catch("engaged"),
      note: z.string(),
    }),
  ),
  revision_plan: z.array(z.object({ step: z.string(), detail: z.string() })).describe("Ordered: what to fix first so later revisions aren't wasted."),
});

export type ReportData = z.infer<typeof ReportSchema> & { kind: "fiction" | "nonfiction" };

const SYSTEM = `You are the editorial panel in Verse, writing a developmental edit report for an author about their own manuscript. You combine four perspectives:
- Developmental editor: structure, plot, stakes, pacing.
- Character editor: motivation, consistency, arcs.
- Reader: where a reader is hooked, confused, moved or tempted to skim.
- Line-level observations only when they are a pattern across the book (not copyediting).

Principles:
- Be honest and specific, like a respected professional editor: name real strengths and real problems, with chapters. No flattery, no generic advice that would fit any book.
- Judge the book on its own terms and genre. Recommendations, not rules: there is no single correct structure.
- Never rewrite the author's prose or invent plot. Suggest approaches; the creative decisions are theirs.
- Ground claims in the text. Evidence quotes must be copied verbatim from the labelled paragraphs.
- If the manuscript appears to be partial or a draft, say so and judge what is there.
- The revision plan is ordered by dependency: big structural changes first, polish last. 3-6 steps.
- Give 2-5 strengths and 2-6 priorities, most important first.`;

interface Loaded {
  title: string;
  genre: string | null;
  kind: "fiction" | "nonfiction";
  chapters: { idx: number; title: string; paragraphs: string[]; metrics: Record<string, unknown> }[];
}

export async function generateReport(
  loaded: Loaded,
  context: { bible: string; issues: string; totalChapters: number },
): Promise<{ data: ReportData; usage: Usage }> {
  const beats = loaded.kind === "fiction" ? FICTION_BEATS : NONFICTION_BEATS;
  const manuscript = loaded.chapters
    .map((c) => `## [Ch ${c.idx + 1}] ${c.title}\n\n${c.paragraphs.map((p, i) => `[Ch ${c.idx + 1} · P${i}] ${p}`).join("\n\n")}`)
    .join("\n\n");
  const partial = loaded.chapters.length < context.totalChapters ? `\nOnly the first ${loaded.chapters.length} of ${context.totalChapters} chapters are provided.` : "";

  const { data, usage } = await callStructured({
    tier: "reasoning",
    effort: "high",
    system: SYSTEM,
    user: `Book: "${loaded.title}"${loaded.genre ? ` — ${loaded.genre}` : ""} (${loaded.kind})${partial}
Structure framework: ${beats.join(" → ")}

<story_bible>
${context.bible}
</story_bible>

<consistency_issues_already_found>
${context.issues || "(none)"}
</consistency_issues_already_found>

<manuscript>
${manuscript}
</manuscript>

Write the editorial report.`,
    schema: ReportSchema,
    maxTokens: 32000,
  });

  // Keep only evidence quotes that really appear in the cited chapter.
  const byNumber = new Map(loaded.chapters.map((c) => [c.idx + 1, c]));
  const verify = (cites: z.infer<typeof Cite>[]) =>
    cites.flatMap((c) => {
      const ch = byNumber.get(c.chapter);
      if (!ch) return [];
      const at = locateQuote(ch.paragraphs, c.paragraph, c.quote);
      return at === null ? [] : [{ chapter: c.chapter, paragraph: at, quote: c.quote }];
    });
  const validChapter = (n: number | null) => (n !== null && byNumber.has(n) ? n : null);

  return {
    data: {
      ...data,
      kind: loaded.kind,
      structure: data.structure.map((b) => ({ ...b, chapter: validChapter(b.chapter) })),
      strengths: data.strengths.map((s) => ({ ...s, evidence: verify(s.evidence) })),
      priorities: data.priorities.map((p) => ({ ...p, evidence: verify(p.evidence) })),
    },
    usage,
  };
}

/** Worker entry point for a `kind = 'report'` run. */
export async function runReport(
  db: SupabaseClient,
  run: { id: string; book_id: string; version_id: string; owner_id: string; chapter_limit: number | null },
): Promise<void> {
  const setStage = (stage: string, progress: number) => db.from("analysis_runs").update({ stage, progress }).eq("id", run.id);
  await setStage("Reading your manuscript", 5);

  const { data: book } = await db.from("books").select("title, genre, kind").eq("id", run.book_id).single();
  let q = db.from("chapters").select("id, idx, title, metrics").eq("version_id", run.version_id);
  if (run.chapter_limit !== null) q = q.lte("idx", run.chapter_limit);
  const [{ data: chapterRows }, { count: totalChapters }] = await Promise.all([
    q.order("idx"),
    db.from("chapters").select("id", { count: "exact", head: true }).eq("version_id", run.version_id),
  ]);

  const chapters: Loaded["chapters"] = [];
  for (const c of chapterRows ?? []) {
    const { data: paras } = await db.from("paragraphs").select("idx, text").eq("chapter_id", c.id).order("idx").limit(5000);
    chapters.push({ idx: c.idx, title: c.title, metrics: c.metrics ?? {}, paragraphs: (paras ?? []).map((p) => p.text) });
  }

  const [{ data: entities }, { data: issues }] = await Promise.all([
    db.from("entities").select("name, type, role, summary").eq("book_id", run.book_id).order("mention_count", { ascending: false }).limit(40),
    db.from("issues").select("title, severity, category").eq("book_id", run.book_id).eq("status", "open").limit(60),
  ]);
  const bible = (entities ?? []).map((e) => `- ${e.name} (${e.role ?? e.type}): ${e.summary ?? ""}`).join("\n");
  const issueList = (issues ?? []).map((i) => `- [${i.severity}] ${i.category}: ${i.title}`).join("\n");

  await setStage("Your editorial panel is reading", 20);
  const { data, usage } = await generateReport(
    { title: book?.title ?? "Untitled", genre: book?.genre ?? null, kind: book?.kind ?? "fiction", chapters },
    { bible, issues: issueList, totalChapters: totalChapters ?? chapters.length },
  );

  await setStage("Writing your report", 95);
  const { error } = await db.from("editorial_reports").insert({
    book_id: run.book_id,
    owner_id: run.owner_id,
    run_id: run.id,
    version_id: run.version_id,
    chapters_covered: chapters.length,
    data,
  });
  if (error) throw new Error(error.message);

  await db.from("usage_events").insert({
    owner_id: run.owner_id,
    book_id: run.book_id,
    kind: "report",
    quantity: 1,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: usage.costUsd,
  });
  await db
    .from("analysis_runs")
    .update({ status: "succeeded", stage: "Complete", progress: 100, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cost_usd: usage.costUsd, finished_at: new Date().toISOString(), error: null })
    .eq("id", run.id);
}
