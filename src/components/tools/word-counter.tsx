"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";

function stats(text: string) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const chapters = text.match(/^\s*(chapter\s+\w+|prologue|epilogue)\b/gim)?.length ?? 0;
  return {
    words,
    characters: text.length,
    paragraphs,
    chapters,
    pages: Math.ceil(words / 275),
    readingMinutes: Math.ceil(words / 250),
  };
}

export function WordCounter({ ranges }: { ranges: [string, string][] }) {
  const [text, setText] = useState("");
  const s = useMemo(() => stats(text), [text]);
  const hours = Math.floor(s.readingMinutes / 60);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your manuscript here…"
        className="min-h-[420px] w-full resize-y rounded-lg border border-line bg-white p-5 font-serif text-[15px] leading-relaxed outline-none focus:border-gold"
        aria-label="Manuscript text"
      />
      <Card className="h-fit divide-y divide-line">
        {[
          ["Words", s.words.toLocaleString()],
          ["Print pages (est.)", s.pages.toLocaleString()],
          ["Reading time", hours ? `${hours}h ${s.readingMinutes % 60}m` : `${s.readingMinutes} min`],
          ["Chapters found", s.chapters.toLocaleString()],
          ["Paragraphs", s.paragraphs.toLocaleString()],
          ["Characters", s.characters.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between px-5 py-3.5">
            <span className="text-sm text-muted">{k}</span>
            <span className="font-serif text-xl">{v}</span>
          </div>
        ))}
        <div className="px-5 py-4 text-xs text-muted">
          {s.words > 0 && (
            <>
              Genres where {s.words.toLocaleString()} words is typical:{" "}
              {ranges
                .filter(([, r]) => {
                  const [lo, hi] = r.split("–").map((n) => Number(n.replace(/,/g, "")));
                  return s.words >= lo && s.words <= hi;
                })
                .map(([g]) => g)
                .join(", ") || "none — that's fine for a work in progress"}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
