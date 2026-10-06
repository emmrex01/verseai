import type { SupabaseClient } from "@supabase/supabase-js";
import { addUsage, emptyUsage, mapLimit, type Usage } from "@/lib/ai/client";
import { PIPELINE_VERSION, extractChapter, textMetrics, type BookContext, type ChapterExtraction } from "./extract";
import { buildGraph } from "./graph";
import { profileCharacters } from "./profiles";
import { findContradictions, findPacingNotes, findTimelineIssues, findUnresolvedThreads, sortIssues, type ChapterPacing, type Issue } from "./checks";

interface RunRow {
  id: string;
  book_id: string;
  version_id: string;
  owner_id: string;
  chapter_limit: number | null;
}

interface ChapterRow {
  id: string;
  idx: number;
  title: string;
  word_count: number;
  content_hash: string;
}

const CHAPTER_CONCURRENCY = 5;
const INSERT_CHUNK = 500;

class Progress {
  constructor(private db: SupabaseClient, private runId: string) {}
  async set(stage: string, progress: number) {
    await this.db.from("analysis_runs").update({ stage, progress: Math.round(progress) }).eq("id", this.runId);
  }
}

async function insertChunked(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error } = await db.from(table).insert(rows.slice(i, i + INSERT_CHUNK));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
}

async function loadParagraphs(db: SupabaseClient, chapterId: string): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("paragraphs")
      .select("idx, text")
      .eq("chapter_id", chapterId)
      .order("idx")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    data.forEach((p) => (out[p.idx] = p.text));
    if (data.length < 1000) return out;
  }
}

/**
 * Full analysis of one manuscript version. Chapters whose text is unchanged
 * since a previous run reuse their cached extraction and are not billed.
 */
export async function runAnalysis(db: SupabaseClient, run: RunRow): Promise<void> {
  const progress = new Progress(db, run.id);
  let usage: Usage = emptyUsage();

  const { data: book, error: bookErr } = await db.from("books").select("title, genre, kind").eq("id", run.book_id).single();
  if (bookErr) throw new Error(bookErr.message);
  const ctx: BookContext = { title: book.title, genre: book.genre, kind: book.kind };

  let chapterQuery = db.from("chapters").select("id, idx, title, word_count, content_hash").eq("version_id", run.version_id);
  if (run.chapter_limit !== null) chapterQuery = chapterQuery.lte("idx", run.chapter_limit);
  const { data: chapters, error: chErr } = await chapterQuery.order("idx");
  if (chErr) throw new Error(chErr.message);
  const rows = chapters as ChapterRow[];

  await progress.set("Reading manuscript", 3);

  const { data: cached } = await db
    .from("chapter_extractions")
    .select("content_hash, data")
    .eq("book_id", run.book_id)
    .eq("pipeline_version", PIPELINE_VERSION)
    .in("content_hash", rows.map((c) => c.content_hash));
  const cache = new Map((cached ?? []).map((c) => [c.content_hash as string, c.data as ChapterExtraction]));

  // Stage 1: per-chapter extraction (fast model), 5%-60%.
  let done = 0;
  let wordsBilled = 0;
  let reused = 0;
  const paragraphsByChapter = new Map<number, string[]>();
  const extractions = await mapLimit(rows, CHAPTER_CONCURRENCY, async (ch) => {
    const paragraphs = await loadParagraphs(db, ch.id);
    paragraphsByChapter.set(ch.idx, paragraphs);
    let data = cache.get(ch.content_hash);
    if (data) {
      reused++;
    } else {
      const res = await extractChapter(ctx, { idx: ch.idx, title: ch.title, paragraphs });
      data = res.extraction;
      usage = addUsage(usage, res.usage);
      wordsBilled += ch.word_count;
      await db.from("chapter_extractions").upsert({
        owner_id: run.owner_id,
        book_id: run.book_id,
        content_hash: ch.content_hash,
        pipeline_version: PIPELINE_VERSION,
        data,
      });
    }
    const metrics = { ...textMetrics(paragraphs), ...data.pacing, summary: data.summary };
    await db.from("chapters").update({ metrics }).eq("id", ch.id);
    done++;
    await progress.set(`Reading chapter ${done} of ${rows.length}`, 5 + (done / rows.length) * 55);
    return { chapterIdx: ch.idx, data };
  });

  // Stage 2: link entities across the book.
  await progress.set("Mapping characters, places and relationships", 62);
  const { graph, usage: gUsage } = await buildGraph(extractions);
  usage = addUsage(usage, gUsage);

  await progress.set("Building character profiles", 70);
  const { profiles, usage: pUsage } = await profileCharacters(graph, ctx);
  usage = addUsage(usage, pUsage);

  // Stage 3: checks (reasoning model).
  await progress.set("Checking consistency", 78);
  const [contradictions, timeline, threads] = await Promise.all([
    findContradictions(graph, ctx.title),
    findTimelineIssues(graph, ctx.title),
    findUnresolvedThreads(graph, ctx.title, rows.length),
  ]);
  usage = [contradictions.usage, timeline.usage, threads.usage].reduce(addUsage, usage);

  const pacingInput: ChapterPacing[] = extractions.map(({ chapterIdx, data }) => {
    const ch = rows.find((r) => r.idx === chapterIdx)!;
    const paras = paragraphsByChapter.get(chapterIdx) ?? [];
    return {
      idx: chapterIdx,
      title: ch.title,
      words: ch.word_count,
      ...data.pacing,
      dialogue_ratio: textMetrics(paras).dialogue_ratio,
      anchor: (paras[0] ?? "").split(/\s+/).slice(0, 14).join(" "),
    };
  });

  const { data: dismissed } = await db.from("issue_dismissals").select("fingerprint").eq("book_id", run.book_id);
  const dismissedSet = new Set((dismissed ?? []).map((d) => d.fingerprint));
  const issues: Issue[] = sortIssues([...contradictions.issues, ...timeline.issues, ...threads.issues, ...findPacingNotes(pacingInput)]);

  // Stage 4: persist the new Story Bible under this run, then remove older runs' rows.
  await progress.set("Saving your Story Bible", 92);
  const base = { book_id: run.book_id, owner_id: run.owner_id };
  const idByKey = new Map(graph.entities.map((e) => [e.key, crypto.randomUUID()]));
  const entityRows = graph.entities.map((e) => {
    const profile = profiles.get(e.key);
    return {
      id: idByKey.get(e.key),
      ...base,
      run_id: run.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases.slice(0, 12),
      role: profile?.role ?? null,
      summary: profile?.summary ?? e.descriptors.sort((a, b) => b.length - a.length)[0] ?? null,
      profile: profile ?? {},
      mention_count: e.mentionCount,
      first_chapter_idx: e.chapters[0] ?? null,
      last_chapter_idx: e.chapters[e.chapters.length - 1] ?? null,
      chapters_present: e.chapters,
    };
  });

  await insertChunked(db, "entities", entityRows);
  await insertChunked(
    db,
    "entity_facts",
    graph.facts.map((f) => ({ ...base, entity_id: idByKey.get(f.entityKey), chapter_idx: f.chapterIdx, paragraph_idx: f.paragraph, category: f.category, statement: f.statement, quote: f.quote })),
  );
  await insertChunked(
    db,
    "relationships",
    graph.relationships.map((r) => ({ ...base, run_id: run.id, source_entity_id: idByKey.get(r.aKey), target_entity_id: idByKey.get(r.bKey), kind: r.kind, description: r.description, evidence: r.evidence })),
  );
  await insertChunked(
    db,
    "timeline_events",
    graph.events.map((e) => ({ ...base, run_id: run.id, seq: e.seq, chapter_idx: e.chapterIdx, paragraph_idx: e.paragraph, summary: e.summary, time_marker: e.timeMarker, significance: e.significance, entity_names: e.participants, quote: e.quote })),
  );
  await insertChunked(
    db,
    "issues",
    issues.map((i) => ({ ...base, run_id: run.id, ...i, status: dismissedSet.has(i.fingerprint) ? "dismissed" : "open" })),
  );

  for (const table of ["entities", "relationships", "timeline_events", "issues"]) {
    await db.from(table).delete().eq("book_id", run.book_id).neq("run_id", run.id);
  }

  if (wordsBilled > 0) {
    await db.from("usage_events").insert({
      owner_id: run.owner_id,
      book_id: run.book_id,
      kind: "analysis_words",
      quantity: wordsBilled,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: usage.costUsd,
    });
  }

  await db
    .from("analysis_runs")
    .update({
      status: "succeeded",
      stage: "Complete",
      progress: 100,
      words_billed: wordsBilled,
      chapters_reused: reused,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: usage.costUsd,
      finished_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", run.id);
}
