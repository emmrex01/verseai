import { z } from "zod";
import { addUsage, callStructured, emptyUsage, mapLimit, type Usage } from "@/lib/ai/client";
import type { GraphEntity, StoryGraph } from "./graph";

const MAX_PROFILED_CHARACTERS = 30;
const MIN_FACTS_FOR_PROFILE = 3;

const nullableText = (d: string) => z.string().nullable().describe(`${d} null if the manuscript does not establish it.`);

const ProfileSchema = z.object({
  role: z.enum(["protagonist", "antagonist", "major", "supporting", "minor"]).catch("supporting"),
  summary: z.string().describe("2-3 sentences: who this character is in the story."),
  age: nullableText("Stated or clearly implied age."),
  appearance: nullableText("Physical description."),
  personality: nullableText("Key traits shown in the text."),
  goal: nullableText("What they want."),
  motivation: nullableText("Why they want it."),
  fear: nullableText("What they fear or avoid."),
  arc: nullableText("How they change across the chapters provided, e.g. 'Isolation → Trust → Leadership'."),
});

export type CharacterProfile = z.infer<typeof ProfileSchema>;

const SYSTEM = `You write Story Bible character profiles for an author, using ONLY the evidence-backed facts provided from their manuscript. Do not invent details. If the facts do not establish a field, return null for it — authors trust Verse because it never makes things up.`;

export async function profileCharacters(
  graph: StoryGraph,
  book: { title: string; genre?: string | null },
): Promise<{ profiles: Map<string, CharacterProfile>; usage: Usage }> {
  const factsByEntity = new Map<string, typeof graph.facts>();
  for (const f of graph.facts) factsByEntity.set(f.entityKey, [...(factsByEntity.get(f.entityKey) ?? []), f]);

  const candidates: GraphEntity[] = graph.entities
    .filter((e) => e.type === "character" && (factsByEntity.get(e.key)?.length ?? 0) >= MIN_FACTS_FOR_PROFILE)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, MAX_PROFILED_CHARACTERS);

  let usage = emptyUsage();
  const profiles = new Map<string, CharacterProfile>();

  await mapLimit(candidates, 4, async (e) => {
    const facts = (factsByEntity.get(e.key) ?? []).slice(0, 120);
    const listing = facts.map((f) => `- Ch ${f.chapterIdx + 1} [${f.category}] ${f.statement}`).join("\n");
    const { data, usage: u } = await callStructured({
      tier: "fast",
      system: SYSTEM,
      user: `Book: "${book.title}"${book.genre ? ` (${book.genre})` : ""}\nCharacter: ${e.name}${e.aliases.length ? ` (also called ${e.aliases.join(", ")})` : ""}\nAppears in chapters: ${e.chapters.map((c) => c + 1).join(", ")}\nDescriptions: ${e.descriptors.slice(0, 5).join(" / ")}\n\nFacts:\n${listing}`,
      schema: ProfileSchema,
      maxTokens: 2000,
    });
    usage = addUsage(usage, u);
    profiles.set(e.key, data);
  });

  return { profiles, usage };
}
