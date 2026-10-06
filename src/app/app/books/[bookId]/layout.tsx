import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { BookNav } from "@/components/book-nav";

export default async function BookLayout({ children, params }: LayoutProps<"/app/books/[bookId]">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);
  const { count } = await supabase.from("issues").select("id", { count: "exact", head: true }).eq("book_id", bookId).eq("status", "open");

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
      <aside className="sticky top-22 hidden h-[calc(100vh-7rem)] w-56 shrink-0 overflow-y-auto lg:block">
        <BookNav bookId={bookId} title={book.title} openIssues={count ?? 0} />
      </aside>
      <div className="min-w-0 flex-1">
        <details className="mb-6 rounded-lg border border-line bg-white p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">{book.title} — menu</summary>
          <div className="mt-4">
            <BookNav bookId={bookId} title={book.title} openIssues={count ?? 0} />
          </div>
        </details>
        {children}
      </div>
    </div>
  );
}
