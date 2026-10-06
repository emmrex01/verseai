import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { ManuscriptUpload } from "@/components/manuscript-upload";

export default async function UploadPage({ params }: PageProps<"/app/books/[bookId]/upload">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{book.current_version_id ? "New version" : "Step 2 of 2"}</p>
      <h1 className="mt-2 font-serif text-3xl">Import your manuscript</h1>
      <p className="mt-2 text-sm text-muted">
        Verse detects chapters from Word heading styles or lines like &ldquo;Chapter 1&rdquo;, and scene breaks like &ldquo;* * *&rdquo;. Your file stays private to your account.
      </p>
      <div className="mt-8">
        <ManuscriptUpload bookId={bookId} />
      </div>
    </div>
  );
}
