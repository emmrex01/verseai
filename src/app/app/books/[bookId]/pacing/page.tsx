import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getBook } from "@/lib/books";
import { PacingChart, momentum, type PacingPoint } from "@/components/pacing-chart";
import { Card, EmptyState, PageHeader, SeverityBadge, type Severity } from "@/components/ui";

export default async function PacingPage({ params }: PageProps<"/app/books/[bookId]/pacing">) {
  const { bookId } = await params;
  const { supabase } = await requireUser();
  const book = await getBook(supabase, bookId);
  const [{ data: chapters }, { data: notes }] = await Promise.all([
    supabase.from("chapters").select("idx, title, word_count, metrics").eq("version_id", book.current_version_id ?? "").order("idx"),
    supabase.from("issues").select("id, title, severity, explanation, status").eq("book_id", bookId).eq("category", "pacing").eq("status", "open"),
  ]);
  const points: (PacingPoint & { dialogue_ratio?: number; summary?: string })[] = (chapters ?? []).map((c) => ({ idx: c.idx, title: c.title, words: c.word_count, ...(c.metrics as object) }));
  if (!points.some((p) => p.tension)) {
    return <EmptyState title="No pacing data yet" description="Pacing appears after your manuscript is analyzed." />;
  }
  const maxWords = Math.max(...points.map((p) => p.words));

  return (
    <div>
      <PageHeader
        eyebrow="Analyze"
        title="Pacing"
        description="How tension, conflict and emotional movement rise and fall across your chapters. There is no single correct shape — use this to spot stretches that may feel slower than you intend."
      />
      <Card className="p-6">
        <PacingChart points={points} bookId={bookId} />
        <p className="mt-4 text-xs text-muted">Bar height is momentum (average of tension, conflict and emotional movement). A red dot marks a turning point. Click a bar to read the chapter.</p>
      </Card>

      {(notes ?? []).length > 0 && (
        <div className="mt-6 space-y-3">
          {(notes ?? []).map((n) => (
            <Card key={n.id} className="p-5">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={n.severity as Severity} />
                <p className="font-medium">{n.title}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{n.explanation}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Chapter</th>
              <th className="px-3 py-3 font-medium">Length</th>
              <th className="px-3 py-3 font-medium">Tension</th>
              <th className="px-3 py-3 font-medium">Conflict</th>
              <th className="px-3 py-3 font-medium">Emotion</th>
              <th className="px-3 py-3 font-medium">Dialogue</th>
              <th className="px-3 py-3 font-medium">Momentum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {points.map((p) => (
              <tr key={p.idx}>
                <td className="px-5 py-2.5">
                  <Link href={`/app/books/${bookId}/manuscript?ch=${p.idx}`} className="hover:text-burgundy">
                    {p.idx + 1}. {p.title}
                  </Link>
                  {p.turning_point && <span className="ml-2 text-xs text-burgundy">turning point</span>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-paper">
                      <div className="h-full rounded-full bg-muted/50" style={{ width: `${(p.words / maxWords) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted">{p.words.toLocaleString()}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">{p.tension ?? "–"}</td>
                <td className="px-3 py-2.5">{p.conflict ?? "–"}</td>
                <td className="px-3 py-2.5">{p.emotional_shift ?? "–"}</td>
                <td className="px-3 py-2.5">{p.dialogue_ratio !== undefined ? `${Math.round(p.dialogue_ratio * 100)}%` : "–"}</td>
                <td className="px-3 py-2.5 font-medium">{momentum(p).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
