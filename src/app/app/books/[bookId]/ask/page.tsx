import { requireUser } from "@/lib/supabase/server";
import { getBook, getRuns } from "@/lib/books";
import { getAllowance } from "@/lib/billing/usage";
import { AskPanel, type QA } from "@/components/ask-panel";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function AskPage({ params }: PageProps<"/app/books/[bookId]/ask">) {
  const { bookId } = await params;
  const { supabase, user } = await requireUser();
  const book = await getBook(supabase, bookId);
  const [{ data: history }, allowance, runs] = await Promise.all([
    supabase.from("questions").select("id, question, answer, support, citations").eq("book_id", bookId).order("created_at", { ascending: false }).limit(30),
    getAllowance(supabase, user.id),
    getRuns(supabase, bookId),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Analyze"
        title="Ask your book"
        description="Answers come only from your manuscript, with the passages to prove it. If your text doesn't establish something, Verse will say so."
      />
      {!book.current_version_id ? (
        <EmptyState title="Upload a manuscript first" description="Ask Your Book answers questions from your own text." />
      ) : (
        <>
          {!runs.lastSucceeded && <p className="mb-4 rounded-md bg-gold-soft px-4 py-3 text-sm">Answers get better once your first analysis finishes and the Story Bible is built.</p>}
          <AskPanel bookId={bookId} history={(history ?? []) as QA[]} remaining={allowance.questionsRemaining} />
        </>
      )}
    </div>
  );
}
