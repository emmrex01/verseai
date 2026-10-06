import Link from "next/link";

export interface PacingPoint {
  idx: number;
  title: string;
  words: number;
  tension?: number;
  conflict?: number;
  emotional_shift?: number;
  turning_point?: boolean;
}

export const momentum = (p: PacingPoint) => ((p.tension ?? 0) + (p.conflict ?? 0) + (p.emotional_shift ?? 0)) / 3;

/** Bar per chapter: height = momentum (1-10); a gold dot marks turning points. */
export function PacingChart({ points, bookId, height = 160 }: { points: PacingPoint[]; bookId: string; height?: number }) {
  if (!points.length) return null;
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="Story momentum by chapter">
        {points.map((p) => {
          const m = momentum(p);
          return (
            <Link
              key={p.idx}
              href={`/app/books/${bookId}/manuscript?ch=${p.idx}`}
              title={`${p.title}: momentum ${m.toFixed(1)}/10${p.turning_point ? " · turning point" : ""}`}
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              {p.turning_point && <span className="mx-auto mb-1 h-1.5 w-1.5 rounded-full bg-burgundy" />}
              <span className={`block rounded-t ${m < 4 ? "bg-burgundy/60" : "bg-gold/80"} group-hover:bg-ink`} style={{ height: `${Math.max(4, m * 10)}%` }} />
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>Ch 1</span>
        <span>Ch {points[points.length - 1].idx + 1}</span>
      </div>
    </div>
  );
}
