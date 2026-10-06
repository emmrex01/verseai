import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { deleteBook } from "../../../actions";
import { Button, Card, PageHeader } from "@/components/ui";

export default async function BookSettingsPage({ params, searchParams }: PageProps<"/app/books/[bookId]/settings">) {
  const { bookId } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);
  const { data: versions } = await supabase.from("manuscript_versions").select("id, version_no, source_filename, word_count, created_at").eq("book_id", bookId).order("version_no", { ascending: false });

  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Book" title="Book settings" />
      <Card className="p-6">
        <h2 className="font-serif text-xl">Versions</h2>
        <ul className="mt-4 divide-y divide-line text-sm">
          {(versions ?? []).map((v) => (
            <li key={v.id} className="flex justify-between py-2.5">
              <span>
                Version {v.version_no} · {v.source_filename}
                {v.id === book.current_version_id && <span className="ml-2 text-xs text-sage">current</span>}
              </span>
              <span className="text-muted">
                {v.word_count.toLocaleString()} words · {new Date(v.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
          {!versions?.length && <li className="py-2.5 text-muted">No uploads yet.</li>}
        </ul>
      </Card>

      <Card className="mt-6 border-critical/30 p-6">
        <h2 className="font-serif text-xl text-critical">Delete this book</h2>
        <p className="mt-2 text-sm text-muted">Permanently deletes every manuscript version, the original files, the Story Bible, issues and questions. This cannot be undone.</p>
        <form action={deleteBook} className="mt-5 space-y-3">
          <input type="hidden" name="bookId" value={bookId} />
          <label className="block text-sm">
            <span className="text-muted">
              Type <strong className="text-ink">{book.title}</strong> to confirm
            </span>
            <input name="confirm" required className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-critical" />
          </label>
          {error === "confirm" && <p className="text-sm text-critical">The title didn&apos;t match.</p>}
          <Button type="submit" className="bg-critical hover:bg-critical/90">
            Delete permanently
          </Button>
        </form>
      </Card>
    </div>
  );
}
