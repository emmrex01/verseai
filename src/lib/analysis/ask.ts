import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addUsage, callStructured, type Usage } from "@/lib/ai/client";
import { quoteAppearsIn } from "./evidence";

const PlanSchema = z.object({
  search_terms: z.array(z.string()).describe("4-12 single words or short names to search the manuscript for: names, aliases, objects, places, and synonyms of the key idea."),
  max_chapter: z.number().int().nullable().describe("If the question is limited to 'by chapter N' or 'before chapter N', that chapter number. Otherwise null."),
});

const AnswerSchema = z.object({
  answer: z.string().describe("Direct answer in 1-4 short paragraphs, citing chapters inline like (Ch 4)."),
  support: z.enum(["established", "implied", "not_found"]).catch("implied").describe("established = the text states it; implied = reasonable inference; not_found = the passages don't answer it."),
  citations: z.array(
    z.object({
      chapter: z.number().int().describe("Chapter number as labelled."),
      paragraph: z.number().int(),
      quote: z.string().describe("Verbatim words copied from that passage, 5-30 words."),
    }),
  ),
});

export interface Citation {
  chapter_idx: number;
  chapter_title: string;
  paragraph_idx: number;
  quote: string;
}

export interface Answer {
  answer: string;
  support: "established" | "implied" | "not_found";
  citations: Citation[];
  usage: Usage;
}

const PLAN_SYSTEM = `You turn an author's question about their own manuscript into full-text search terms. Include character names and likely aliases, key nouns, and a few synonyms. Never answer the question.`;

const ANSWER_SYSTEM = `You are "Ask Your Book" in Verse. You answer an author's questions about their own manuscript using ONLY the passages and Story Bible notes provided. You are not a writing assistant here — you are a precise reader.

- Distinguish what the text establishes from what it only implies, and say plainly when the manuscript does not answer the question ("The manuscript doesn't establish…").
- Respect chapter limits in the question (e.g. "by Chapter 12" means ignore later chapters).
- Cite every claim with a verbatim quote from a provided passage. Never quote anything not shown.
- Be concise and concrete. Never invent events, motives or details.`;

export async function askBook(db: SupabaseClient, bookId: string, question: string): Promise<Answer> {
  const { data: plan, usage: planUsage } = await callStructured({
    tier: "fast",
    system: PLAN_SYSTEM,
    user: question,
    schema: PlanSchema,
    maxTokens: 600,
  });

  const maxChapterIdx = plan.max_chapter != null ? plan.max_chapter - 1 : null;
  const terms = plan.search_terms
    .map((t) => t.replace(/["()]/g, "").trim())
    .filter(Boolean)
    .map((t) => (t.includes(" ") ? `"${t}"` : t));

  const [{ data: hits, error }, { data: chapters }, { data: entities }] = await Promise.all([
    db.rpc("search_paragraphs", { p_book_id: bookId, p_query: terms.join(" or "), p_max_chapter: maxChapterIdx, p_limit: 40 }),
    db.from("books").select("current_version_id").eq("id", bookId).single().then(async ({ data }) =>
      db.from("chapters").select("idx, title, metrics").eq("version_id", data?.current_version_id ?? "").order("idx"),
    ),
    db.from("entities").select("name, aliases, type, summary").eq("book_id", bookId).order("mention_count", { ascending: false }).limit(60),
  ]);
  if (error) throw new Error(error.message);

  const passages = (hits ?? []) as { chapter_idx: number; chapter_title: string; paragraph_idx: number; text: string }[];
  passages.sort((a, b) => a.chapter_idx - b.chapter_idx || a.paragraph_idx - b.paragraph_idx);

  const outline = (chapters ?? [])
    .filter((c) => maxChapterIdx == null || c.idx <= maxChapterIdx)
    .map((c) => `Ch ${c.idx + 1} "${c.title}": ${(c.metrics as { summary?: string })?.summary ?? ""}`)
    .join("\n");
  const bible = (entities ?? [])
    .filter((e) => e.summary)
    .map((e) => `- ${e.name} (${e.type}): ${e.summary}`)
    .join("\n");
  const passageText = passages.map((p) => `[Ch ${p.chapter_idx + 1} · P${p.paragraph_idx}] ${p.text}`).join("\n\n");

  const { data: ans, usage: ansUsage } = await callStructured({
    tier: "reasoning",
    effort: "medium",
    system: ANSWER_SYSTEM,
    user: `<chapter_outline>\n${outline}\n</chapter_outline>\n\n<story_bible>\n${bible}\n</story_bible>\n\n<passages>\n${passageText || "(no matching passages found)"}\n</passages>\n\nQuestion: ${question}`,
    schema: AnswerSchema,
    maxTokens: 6000,
  });

  // Keep only citations whose quote is really in a retrieved passage.
  const citations: Citation[] = [];
  for (const c of ans.citations) {
    const match =
      passages.find((p) => p.chapter_idx === c.chapter - 1 && p.paragraph_idx === c.paragraph && quoteAppearsIn(p.text, c.quote)) ??
      passages.find((p) => quoteAppearsIn(p.text, c.quote));
    if (match && !citations.some((x) => x.chapter_idx === match.chapter_idx && x.paragraph_idx === match.paragraph_idx)) {
      citations.push({ chapter_idx: match.chapter_idx, chapter_title: match.chapter_title, paragraph_idx: match.paragraph_idx, quote: c.quote });
    }
  }

  // An "established" answer with no verifiable evidence is downgraded.
  const support = ans.support === "established" && citations.length === 0 ? "implied" : ans.support;
  return { answer: ans.answer, support, citations, usage: addUsage(planUsage, ansUsage) };
}
