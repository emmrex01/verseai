import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllowance } from "@/lib/billing/usage";
import { askBook } from "@/lib/analysis/ask";
import { AIError } from "@/lib/ai/client";

export const maxDuration = 90;

const Body = z.object({ question: z.string().trim().min(3).max(500) });

export async function POST(request: Request, ctx: RouteContext<"/api/books/[bookId]/ask">) {
  const { bookId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question between 3 and 500 characters." }, { status: 400 });

  const { data: book } = await supabase.from("books").select("id, current_version_id").eq("id", bookId).maybeSingle();
  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });
  if (!book.current_version_id) return NextResponse.json({ error: "Upload a manuscript first." }, { status: 400 });

  const allowance = await getAllowance(supabase, auth.user.id);
  if (allowance.questionsRemaining <= 0) {
    return NextResponse.json(
      { error: `You've used all ${allowance.plan.monthlyQuestions} questions on the ${allowance.plan.name} plan this month.`, upgrade: true },
      { status: 402 },
    );
  }

  try {
    // The user's own client: retrieval runs under RLS.
    const result = await askBook(supabase, bookId, parsed.data.question);
    const admin = createAdminClient();
    const [{ data: saved }] = await Promise.all([
      admin
        .from("questions")
        .insert({ book_id: bookId, owner_id: auth.user.id, question: parsed.data.question, answer: result.answer, support: result.support, citations: result.citations })
        .select("id, created_at")
        .single(),
      admin.from("usage_events").insert({
        owner_id: auth.user.id,
        book_id: bookId,
        kind: "question",
        quantity: 1,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cost_usd: result.usage.costUsd,
      }),
    ]);
    return NextResponse.json({ id: saved?.id, question: parsed.data.question, answer: result.answer, support: result.support, citations: result.citations });
  } catch (err) {
    console.error("ask failed", err);
    const message = err instanceof AIError ? err.message : "Something went wrong answering that. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
