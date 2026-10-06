import { z } from "zod";
import { addUsage, callStructured, emptyUsage, type Usage } from "@/lib/ai/client";
import type { ChapterExtraction } from "./extract";

export type EntityType = "character" | "location" | "object" | "organization";

export interface GraphEntity {
  key: string;
  type: EntityType;
  name: string;
  aliases: string[];
  descriptors: string[];
  chapters: number[];
  mentionCount: number;
}

export interface Evidence {
  chapter_idx: number;
  paragraph_idx: number;
  quote: string;
  note?: string;
}

export interface GraphFact {
  id: string;
  entityKey: string;
  chapterIdx: number;
  paragraph: number;
  category: string;
  statement: string;
  quote: string;
}

export interface GraphRelationship {
  aKey: string;
  bKey: string;
  kind: string;
  description: string;
  evidence: Evidence[];
}

export interface GraphEvent {
  id: string;
  seq: number;
  chapterIdx: number;
  paragraph: number;
  summary: string;
  timeMarker: string | null;
  significance: "major" | "minor";
  participants: string[];
  quote: string;
}

export interface GraphThread {
  id: string;
  chapterIdx: number;
  paragraph: number;
  status: "opened" | "advanced" | "resolved";
  thread: string;
  quote: string;
}

export interface StoryGraph {
  entities: GraphEntity[];
  facts: GraphFact[];
  relationships: GraphRelationship[];
  events: GraphEvent[];
  threads: GraphThread[];
}

const TITLES = /^(mr|mrs|ms|miss|dr|prof|professor|sir|lady|lord|captain|capt|detective|det|officer|inspector|aunt|uncle|father|mother)\.?\s+/i;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']s$/, "")
    .replace(/[^\p{L}\p{N}\s.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
}

/** Union-find over names: exact name/alias matches within a type are the same entity. */
class Groups {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

const ResolutionSchema = z.object({
  merges: z.array(
    z.object({
      canonical_name: z.string(),
      members: z.array(z.string()).describe("Names exactly as listed that refer to the same entity."),
    }),
  ),
});

const RESOLVE_SYSTEM = `You resolve entity names for a manuscript's Story Bible. You receive names that an extractor found across chapters, each with descriptions and chapter numbers.

Return merges ONLY for names that certainly refer to the same entity (e.g. "Sarah" and "Sarah Mitchell" when descriptions agree; "Dr. Okafor" and "Helen Okafor" when clearly the same person).
Never merge different people who share a surname (e.g. a father and daughter), or different places that share a word. When in doubt, do not merge — a wrong merge creates false contradictions.`;

interface RawEntityRef {
  type: EntityType;
  name: string;
  aliases: string[];
  descriptor: string;
  chapterIdx: number;
}

export async function buildGraph(
  extractions: { chapterIdx: number; data: ChapterExtraction }[],
  options: { resolveWithModel?: boolean } = {},
): Promise<{ graph: StoryGraph; usage: Usage }> {
  let usage = emptyUsage();
  const refs: RawEntityRef[] = extractions.flatMap(({ chapterIdx, data }) =>
    data.entities.map((e) => ({ ...e, chapterIdx })),
  );

  const groups = new Groups();
  const k = (type: string, name: string) => `${type}:${normalizeName(name)}`;
  for (const r of refs) {
    const base = k(r.type, r.name);
    groups.find(base);
    for (const a of r.aliases) if (normalizeName(a)) groups.union(base, k(r.type, a));
    const stripped = normalizeName(r.name).replace(TITLES, "");
    if (stripped && stripped !== normalizeName(r.name)) groups.union(base, `${r.type}:${stripped}`);
  }

  // Ask the model only about ambiguous cases: names sharing a word within a type.
  if (options.resolveWithModel !== false) {
    const summaries = summarizeGroups(refs, groups);
    for (const type of ["character", "location", "object", "organization"] as EntityType[]) {
      const ofType = summaries.filter((s) => s.type === type).sort((a, b) => b.count - a.count).slice(0, 150);
      if (!hasOverlappingWords(ofType.map((s) => s.name))) continue;
      const listing = ofType
        .map((s) => `- ${s.name}${s.aliases.length ? ` (also: ${s.aliases.join(", ")})` : ""} — chapters ${s.chapters.map((c) => c + 1).join(", ")} — ${s.descriptors.slice(0, 2).join(" / ")}`)
        .join("\n");
      const { data, usage: u } = await callStructured({
        tier: "reasoning",
        effort: "low",
        system: RESOLVE_SYSTEM,
        user: `Entity type: ${type}\n\n${listing}`,
        schema: ResolutionSchema,
        maxTokens: 8000,
      });
      usage = addUsage(usage, u);
      const known = new Set(ofType.map((s) => normalizeName(s.name)));
      for (const m of data.merges) {
        const members = m.members.map(normalizeName).filter((n) => known.has(n));
        for (let i = 1; i < members.length; i++) groups.union(`${type}:${members[0]}`, `${type}:${members[i]}`);
      }
    }
  }

  // Build entities keyed by group root.
  interface Acc { type: EntityType; names: Map<string, number>; aliases: Set<string>; descriptors: string[]; chapters: Set<number>; count: number }
  const byRoot = new Map<string, Acc>();
  for (const r of refs) {
    const root = groups.find(k(r.type, r.name));
    const g: Acc = byRoot.get(root) ?? { type: r.type, names: new Map(), aliases: new Set(), descriptors: [], chapters: new Set(), count: 0 };
    g.names.set(r.name, (g.names.get(r.name) ?? 0) + 1);
    r.aliases.forEach((a) => g.aliases.add(a));
    if (r.descriptor && g.descriptors.length < 12) g.descriptors.push(r.descriptor);
    g.chapters.add(r.chapterIdx);
    g.count++;
    byRoot.set(root, g);
  }

  const entities: GraphEntity[] = [];
  for (const [root, g] of byRoot) {
    const name = [...g.names.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    const aliases = [...new Set([...g.names.keys(), ...g.aliases])].filter((a) => normalizeName(a) !== normalizeName(name));
    entities.push({ key: root, type: g.type, name, aliases, descriptors: g.descriptors, chapters: [...g.chapters].sort((a, b) => a - b), mentionCount: g.count });
  }

  // Resolve any name (used in facts/relationships) to an entity key.
  const lookup = new Map<string, string>();
  for (const e of entities) {
    for (const n of [e.name, ...e.aliases]) {
      const nn = normalizeName(n);
      if (!lookup.has(nn)) lookup.set(nn, groups.find(e.key));
      const stripped = nn.replace(TITLES, "");
      if (stripped && !lookup.has(stripped)) lookup.set(stripped, groups.find(e.key));
    }
  }
  const resolve = (name: string) => lookup.get(normalizeName(name)) ?? lookup.get(normalizeName(name).replace(TITLES, ""));

  const facts: GraphFact[] = [];
  const relMap = new Map<string, GraphRelationship>();
  const events: GraphEvent[] = [];
  const threads: GraphThread[] = [];

  for (const { chapterIdx, data } of extractions) {
    for (const f of data.facts) {
      const key = resolve(f.entity);
      if (!key) continue;
      facts.push({ id: `F${facts.length + 1}`, entityKey: key, chapterIdx, paragraph: f.paragraph, category: f.category, statement: f.statement, quote: f.quote });
    }
    for (const r of data.relationships) {
      const a = resolve(r.a);
      const b = resolve(r.b);
      if (!a || !b || a === b) continue;
      const [x, y] = [a, b].sort();
      const id = `${x}|${y}|${r.kind.toLowerCase()}`;
      const rel = relMap.get(id) ?? { aKey: a, bKey: b, kind: r.kind, description: r.description, evidence: [] };
      if (rel.evidence.length < 5) rel.evidence.push({ chapter_idx: chapterIdx, paragraph_idx: r.paragraph, quote: r.quote });
      relMap.set(id, rel);
    }
    for (const e of [...data.events].sort((a, b) => a.paragraph - b.paragraph)) {
      events.push({ id: `E${events.length + 1}`, seq: events.length, chapterIdx, paragraph: e.paragraph, summary: e.summary, timeMarker: e.time_marker, significance: e.significance, participants: e.participants, quote: e.quote });
    }
    for (const t of data.threads) {
      threads.push({ id: `T${threads.length + 1}`, chapterIdx, paragraph: t.paragraph, status: t.status, thread: t.thread, quote: t.quote });
    }
  }

  return { graph: { entities, facts, relationships: [...relMap.values()], events, threads }, usage };
}

function summarizeGroups(refs: RawEntityRef[], groups: Groups) {
  const map = new Map<string, { type: EntityType; name: string; aliases: string[]; descriptors: string[]; chapters: number[]; count: number }>();
  for (const r of refs) {
    const root = groups.find(`${r.type}:${normalizeName(r.name)}`);
    const s = map.get(root) ?? { type: r.type, name: r.name, aliases: [], descriptors: [], chapters: [], count: 0 };
    if (r.name.length > s.name.length) s.name = r.name;
    for (const a of r.aliases) if (!s.aliases.includes(a) && s.aliases.length < 5) s.aliases.push(a);
    if (s.descriptors.length < 3 && r.descriptor) s.descriptors.push(r.descriptor);
    if (!s.chapters.includes(r.chapterIdx)) s.chapters.push(r.chapterIdx);
    s.count++;
    map.set(root, s);
  }
  return [...map.values()];
}

function hasOverlappingWords(names: string[]): boolean {
  const seen = new Set<string>();
  for (const n of names) {
    const words = new Set(normalizeName(n).replace(TITLES, "").split(" ").filter((w) => w.length > 2));
    for (const w of words) {
      if (seen.has(w)) return true;
    }
    words.forEach((w) => seen.add(w));
  }
  return false;
}
