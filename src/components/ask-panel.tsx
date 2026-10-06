"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { passageHref } from "@/lib/links";
import { Button, ButtonLink, Card } from "@/components/ui";

export interface QA {
  id?: string;
  question: string;
  answer: string;
  support: "established" | "implied" | "not_found";
  citations: { chapter_idx: number; chapter_title: string; paragraph_idx: number; quote: string }[];
}

const SUPPORT: Record<QA["support"], [string, string]> = {
  established: ["Established in the text", "bg-sage-soft text-sage"],
  implied: ["Implied, not stated", "bg-gold-soft text-[#7d5f2c]"],
  not_found: ["Not established in the manuscript", "bg-paper text-muted"],
};

const EXAMPLES = ["What does the protagonist want most, and when is it first stated?", "Which characters know the secret by the midpoint?", "Where is every scene set in the first five chapters?"];

export function AskPanel({ bookId, history, remaining }: { bookId: string; history: QA[]; remaining: number }) {
  const [items, setItems] = useState<QA[]>(history);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [left, setLeft] = useState(remaining);

  async function ask(q: string) {
    if (q.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${bookId}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error ?? "Something went wrong.", upgrade: data.upgrade });
      } else {
        setItems((prev) => [data, ...prev]);
        setQuestion("");
        setLeft((n) => Math.max(0, n - 1));
      }
    } catch {
      setError({ message: "Network error. Please try again." });
    }
    setBusy(false);
  }

  return (
    <div>
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask your book anything… e.g. “What does Sarah know about Daniel by Chapter 12?”"
            className="h-11 flex-1 rounded-md border border-line bg-white px-4 outline-none focus:border-gold"
            aria-label="Your question"
          />
          <Button type="submit" disabled={busy || question.trim().length < 3} className="h-11">
            <Send className="h-4 w-4" aria-hidden /> {busy ? "Reading…" : "Ask"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {items.length === 0 &&
              EXAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => setQuestion(q)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-paper">
                  {q}
                </button>
              ))}
          </div>
          <span className="text-xs text-muted">{left} questions left this month</span>
        </div>
      </Card>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md bg-amber-soft px-4 py-3 text-sm text-amber">
          {error.message}
          {error.upgrade && (
            <ButtonLink href="/app/billing" size="sm" variant="secondary">
              Upgrade
            </ButtonLink>
          )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {items.map((qa, i) => (
          <Card key={qa.id ?? i} className="p-6">
            <p className="font-medium">{qa.question}</p>
            <span className={`mt-3 inline-block rounded px-2 py-0.5 text-xs font-medium ${SUPPORT[qa.support][1]}`}>{SUPPORT[qa.support][0]}</span>
            <div className="mt-3 space-y-3 text-sm leading-relaxed">
              {qa.answer.split(/\n{2,}/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
            {qa.citations.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">References</p>
                {qa.citations.map((c, j) => (
                  <Link key={j} href={passageHref(bookId, c.chapter_idx, c.paragraph_idx)} className="block rounded-md border-l-2 border-gold bg-paper/70 px-3 py-2 hover:bg-paper">
                    <span className="text-xs font-medium text-muted">
                      Chapter {c.chapter_idx + 1} · {c.chapter_title}
                    </span>
                    <span className="mt-0.5 block font-serif text-sm">“{c.quote}”</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
