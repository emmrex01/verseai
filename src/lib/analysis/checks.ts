import { createHash } from "node:crypto";
import { z } from "zod";
import { addUsage, callStructured, emptyUsage, mapLimit, type Usage } from "@/lib/ai/client";
import type { Evidence, GraphEntity, GraphFact, StoryGraph } from "./graph";
import { normalizeForMatch } from "./evidence";

export type Severity = "critical" | "high" | "medium" | "low";
export type IssueCategory = "character" | "timeline" | "location" | "object" | "plot" | "pacing";

export interface Issue {
  category: IssueCategory;
  severity: Severity;
  title: string;
  explanation: string;
  possible_intent: string | null;
  suggestion: string | null;
  entity_names: string[];
  evidence: Evidence[];
  fingerprint: string;
}

const MAX_FACTS_PER_CALL = 260;

const PRECISION_RULES = `Precision matters more than recall. A false alarm costs the author time and trust; only report a problem a careful human editor would flag.

NOT problems:
- A character lying, being mistaken, misremembering, or an unreliable narrator — unless the text treats the claim as true.
- Change over time that the story explains (aging, moving house, healing, a new haircut).
- Ambiguity, vagueness, or details that are simply unmentioned.
- Deliberate mysteries and red herrings that are still open.

For each problem, give your best reading of whether it could be intentional in "possible_intent" (null if it is clearly an error). Be specific and cite chapters. Never say "AI detected"; describe it as a potential inconsistency for the author to judge.

Severity: critical = breaks the plot or reader trust (e.g. a dead character reappears unexplained); high = an attentive reader will notice; medium = noticeable on a close read; low = minor detail.`;

const ContradictionSchema = z.object({
  issues: z.array(
    z.object({
      title: z.string().describe("Short, specific, e.g. \"Sarah's history with Paris\""),
      category: z.enum(["character", "timeline", "location", "object"]).catch("character"),
      severity: z.enum(["critical", "high", "medium", "low"]).catch("medium"),
      explanation: z.string().describe("What conflicts with what, citing chapters, in 1-3 sentences."),
      possible_intent: z.string().nullable(),
      suggestion: z.string().nullable().describe("A concrete way the author could reconcile it."),
      fact_ids: z.array(z.string()).describe("IDs of the conflicting facts, at least two."),
    }),
  ),
});

const CONTRADICTION_SYSTEM = `You are the continuity editor in Verse. You receive evidence-backed facts extracted from an author's manuscript, grouped by entity, in reading order. Find facts that genuinely contradict each other: ages and dates that don't add up, physical descriptions that change without explanation, conflicting backstory, family relationships stated two ways, objects in two places or owned by two people, travel that is impossible in the time given.

${PRECISION_RULES}`;

const TimelineSchema = z.object({
  issues: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]).catch("medium"),
      explanation: z.string(),
      possible_intent: z.string().nullable(),
      suggestion: z.string().nullable(),
      event_ids: z.array(z.string()).describe("IDs of the events involved, at least two."),
    }),
  ),
});

const TIMELINE_SYSTEM = `You are the timeline editor in Verse. You receive the manuscript's events in reading order with any time markers ("three days later", dates, ages, seasons). Reconstruct story chronology and report only impossibilities: events that cannot happen in the stated order, durations that don't add up, dates or seasons that conflict, a character in two places at once.

Flashbacks, flash-forwards and non-linear structure are NOT problems when the text signals them.

${PRECISION_RULES}`;

const ThreadSchema = z.object({
  issues: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(["high", "medium", "low"]).catch("low"),
      explanation: z.string(),
      possible_intent: z.string().nullable(),
      suggestion: z.string().nullable(),
      thread_ids: z.array(z.string()).describe("IDs of the entries where the setup is raised."),
    }),
  ),
});

const THREAD_SYSTEM = `You are the developmental editor in Verse. You receive story threads (setups, questions, promises) noted chapter by chapter with status opened / advanced / resolved. The same thread may be worded differently in different chapters — group them by meaning.

Report significant setups that are opened but never resolved or meaningfully advanced by the end of the manuscript, and setups that are resolved before they were ever raised. Ignore trivial threads and threads opened in the final chapters of an obviously ongoing series, which may be sequel hooks — but you may mention a likely sequel hook as low severity with that possible_intent.

If the manuscript provided appears incomplete (a draft that stops mid-story), only report threads that were abandoned well before the end.

${PRECISION_RULES}`;

export function fingerprint(category: string, entityNames: string[], evidence: Evidence[]): string {
  const h = createHash("sha256");
  h.update(category);
  h.update([...entityNames].map((n) => n.toLowerCase()).sort().join("|"));
  h.update(
    evidence
      .map((e) => normalizeForMatch(e.quote).slice(0, 48))
      .sort()
      .join("|"),
  );
  return h.digest("hex").slice(0, 32);
}

function evidenceFromFacts(facts: GraphFact[]): Evidence[] {
  return facts.map((f) => ({ chapter_idx: f.chapterIdx, paragraph_idx: f.paragraph, quote: f.quote, note: f.statement }));
}

/** Pack entities into batches that fit comfortably in one reasoning call. */
function batchEntities(entities: GraphEntity[], factsByEntity: Map<string, GraphFact[]>): GraphEntity[][] {
  const batches: GraphEntity[][] = [];
  let current: GraphEntity[] = [];
  let size = 0;
  for (const e of entities) {
    const n = Math.min(factsByEntity.get(e.key)!.length, MAX_FACTS_PER_CALL);
    if (size + n > MAX_FACTS_PER_CALL && current.length) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(e);
    size += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

export async function findContradictions(graph: StoryGraph, bookTitle: string): Promise<{ issues: Issue[]; usage: Usage }> {
  const factsByEntity = new Map<string, GraphFact[]>();
  for (const f of graph.facts) factsByEntity.set(f.entityKey, [...(factsByEntity.get(f.entityKey) ?? []), f]);

  // Only entities with facts in at least two chapters can contradict themselves across the book.
  const checkable = graph.entities
    .filter((e) => new Set((factsByEntity.get(e.key) ?? []).map((f) => f.chapterIdx)).size >= 2)
    .sort((a, b) => b.mentionCount - a.mentionCount);

  const batches = batchEntities(checkable, factsByEntity);
  let usage = emptyUsage();
  const issues: Issue[] = [];
  const factById = new Map(graph.facts.map((f) => [f.id, f]));
  const entityByKey = new Map(graph.entities.map((e) => [e.key, e]));

  await mapLimit(batches, 3, async (batch) => {
    const listing = batch
      .map((e) => {
        const facts = factsByEntity.get(e.key)!.slice(0, MAX_FACTS_PER_CALL);
        return `## ${e.name} (${e.type}${e.aliases.length ? `; also ${e.aliases.join(", ")}` : ""})\n${facts
          .map((f) => `${f.id} | Ch ${f.chapterIdx + 1} | ${f.category} | ${f.statement} | "${f.quote}"`)
          .join("\n")}`;
      })
      .join("\n\n");
    const { data, usage: u } = await callStructured({
      tier: "reasoning",
      effort: "high",
      system: CONTRADICTION_SYSTEM,
      user: `Manuscript: "${bookTitle}"\n\n${listing}`,
      schema: ContradictionSchema,
      maxTokens: 16000,
    });
    usage = addUsage(usage, u);
    for (const i of data.issues) {
      const facts = [...new Set(i.fact_ids)].map((id) => factById.get(id)).filter((f): f is GraphFact => Boolean(f));
      // A contradiction needs two pieces of real evidence.
      if (facts.length < 2) continue;
      const names = [...new Set(facts.map((f) => entityByKey.get(f.entityKey)?.name).filter(Boolean) as string[])];
      const evidence = evidenceFromFacts(facts);
      issues.push({ category: i.category, severity: i.severity, title: i.title, explanation: i.explanation, possible_intent: i.possible_intent, suggestion: i.suggestion, entity_names: names, evidence, fingerprint: fingerprint(i.category, names, evidence) });
    }
  });

  return { issues, usage };
}

export async function findTimelineIssues(graph: StoryGraph, bookTitle: string): Promise<{ issues: Issue[]; usage: Usage }> {
  // Events with time markers carry the chronology; major events anchor it.
  const events = graph.events.filter((e) => e.timeMarker || e.significance === "major").slice(0, 450);
  if (events.length < 3) return { issues: [], usage: emptyUsage() };
  const listing = events
    .map((e) => `${e.id} | Ch ${e.chapterIdx + 1} | ${e.timeMarker ?? "—"} | ${e.summary} | ${e.participants.join(", ")}`)
    .join("\n");
  const { data, usage } = await callStructured({
    tier: "reasoning",
    effort: "high",
    system: TIMELINE_SYSTEM,
    user: `Manuscript: "${bookTitle}"\n\nEvents in reading order:\n${listing}`,
    schema: TimelineSchema,
    maxTokens: 12000,
  });
  const byId = new Map(graph.events.map((e) => [e.id, e]));
  const issues: Issue[] = [];
  for (const i of data.issues) {
    const evs = [...new Set(i.event_ids)].map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
    if (evs.length < 2) continue;
    const names = [...new Set(evs.flatMap((e) => e.participants))].slice(0, 6);
    const evidence = evs.map((e) => ({ chapter_idx: e.chapterIdx, paragraph_idx: e.paragraph, quote: e.quote, note: e.timeMarker ? `${e.timeMarker}: ${e.summary}` : e.summary }));
    issues.push({ category: "timeline", severity: i.severity, title: i.title, explanation: i.explanation, possible_intent: i.possible_intent, suggestion: i.suggestion, entity_names: names, evidence, fingerprint: fingerprint("timeline", names, evidence) });
  }
  return { issues, usage };
}

export async function findUnresolvedThreads(graph: StoryGraph, bookTitle: string, chapterCount: number): Promise<{ issues: Issue[]; usage: Usage }> {
  if (graph.threads.length < 2 || chapterCount < 3) return { issues: [], usage: emptyUsage() };
  const listing = graph.threads
    .slice(0, 500)
    .map((t) => `${t.id} | Ch ${t.chapterIdx + 1} | ${t.status} | ${t.thread}`)
    .join("\n");
  const { data, usage } = await callStructured({
    tier: "reasoning",
    effort: "medium",
    system: THREAD_SYSTEM,
    user: `Manuscript: "${bookTitle}" — ${chapterCount} chapters provided.\n\nThreads in reading order:\n${listing}`,
    schema: ThreadSchema,
    maxTokens: 10000,
  });
  const byId = new Map(graph.threads.map((t) => [t.id, t]));
  const issues: Issue[] = [];
  for (const i of data.issues) {
    const ts = [...new Set(i.thread_ids)].map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (ts.length < 1) continue;
    const evidence = ts.slice(0, 4).map((t) => ({ chapter_idx: t.chapterIdx, paragraph_idx: t.paragraph, quote: t.quote, note: t.thread }));
    issues.push({ category: "plot", severity: i.severity, title: i.title, explanation: i.explanation, possible_intent: i.possible_intent, suggestion: i.suggestion, entity_names: [], evidence, fingerprint: fingerprint("plot", [], evidence) });
  }
  return { issues, usage };
}

export interface ChapterPacing {
  idx: number;
  title: string;
  words: number;
  tension: number;
  conflict: number;
  emotional_shift: number;
  turning_point: boolean;
  dialogue_ratio: number;
  /** First paragraph quote, used to anchor pacing notes. */
  anchor: string;
}

/**
 * Pacing is a recommendation, not a verdict: flag chapters whose momentum is
 * well below their neighbours', and long stretches without a turning point.
 */
export function findPacingNotes(chapters: ChapterPacing[]): Issue[] {
  if (chapters.length < 5) return [];
  const momentum = (c: ChapterPacing) => (c.tension + c.conflict + c.emotional_shift) / 3;
  const issues: Issue[] = [];
  const medianWords = [...chapters].map((c) => c.words).sort((a, b) => a - b)[Math.floor(chapters.length / 2)];

  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const neighbours = chapters.slice(Math.max(0, i - 2), i).concat(chapters.slice(i + 1, i + 3));
    const around = neighbours.reduce((s, n) => s + momentum(n), 0) / neighbours.length;
    const drop = around - momentum(c);
    if (drop >= 2.5 && !c.turning_point && i > 0) {
      const long = c.words > medianWords * 1.3;
      const evidence = [{ chapter_idx: c.idx, paragraph_idx: 0, quote: c.anchor, note: `Momentum ${momentum(c).toFixed(1)}/10 vs ${around.toFixed(1)} in surrounding chapters` }];
      issues.push({
        category: "pacing",
        severity: long ? "medium" : "low",
        title: `${c.title} slows noticeably`,
        explanation: `This chapter has markedly less tension, conflict and emotional movement than the chapters around it${long ? `, and at ${c.words.toLocaleString()} words it is longer than most of your chapters` : ""}. Readers may feel the story stall here.`,
        possible_intent: "A deliberate breather after an intense sequence can work well — this is a judgment call, not an error.",
        suggestion: long ? "Consider tightening exposition or moving a story question into this chapter." : "Consider whether a scene here could raise a question or complication.",
        entity_names: [],
        evidence,
        fingerprint: fingerprint("pacing", [c.title], evidence),
      });
    }
  }

  // Long run with no turning point.
  let run = 0;
  for (let i = 0; i < chapters.length; i++) {
    run = chapters[i].turning_point ? 0 : run + 1;
    if (run === 6) {
      const first = chapters[i - 5];
      const evidence = [{ chapter_idx: first.idx, paragraph_idx: 0, quote: first.anchor, note: `No turning point detected in chapters ${first.idx + 1}–${chapters[i].idx + 1}` }];
      issues.push({
        category: "pacing",
        severity: "low",
        title: `Six chapters without a turning point (${first.idx + 1}–${chapters[i].idx + 1})`,
        explanation: "No chapter in this stretch changes the direction of the story. Long runs without a reversal or revelation can feel flat, especially in the middle of a book.",
        possible_intent: "Slow-burn or literary structures may intentionally build gradually.",
        suggestion: "Consider adding a revelation, reversal or decision point in this stretch.",
        entity_names: [],
        evidence,
        fingerprint: fingerprint("pacing-run", [String(first.idx)], evidence),
      });
    }
  }
  return issues;
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues
    .filter((i) => (seen.has(i.fingerprint) ? false : (seen.add(i.fingerprint), true)))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
