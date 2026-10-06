"use client";

import { useState } from "react";
import { Lock, Upload } from "lucide-react";
import { Button, ButtonLink, Card, SeverityBadge, type Severity } from "@/components/ui";

interface Evidence {
  chapter_idx: number;
  quote: string;
  note?: string;
}

interface Result {
  wordsAnalyzed: number;
  truncated: boolean;
  stats: { characters: number; locations: number; events: number; chapters: number };
  counts: Record<Severity, number>;
  preview: null | {
    title: string;
    severity: Severity;
    explanation: string;
    possible_intent: string | null;
    evidence: Evidence[];
    chapterTitles: (string | undefined)[];
  };
  lockedTitles: { severity: Severity; category: string }[];
}

export function ConsistencyChecker() {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setError(null);
    setState("running");
    try {
      let res: Response;
      if (mode === "upload") {
        if (!file) throw new Error("Choose a file first.");
        const body = new FormData();
        body.append("file", file);
        res = await fetch("/api/free-check", { method: "POST", body });
      } else {
        res = await fetch("/api/free-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (state === "done" && result) {
    const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-sm text-muted">
            We analyzed {result.wordsAnalyzed.toLocaleString()} words across {result.stats.chapters} {result.stats.chapters === 1 ? "section" : "sections"}
            {result.truncated && " (the first 12,000 words)"} and mapped {result.stats.characters} characters, {result.stats.locations} locations and {result.stats.events} events.
          </p>
          <p className="mt-4 font-serif text-3xl">{total === 0 ? "No potential inconsistencies found." : `${total} potential ${total === 1 ? "issue" : "issues"} found`}</p>
          {total > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {(["critical", "high", "medium", "low"] as Severity[])
                .filter((s) => result.counts[s] > 0)
                .map((s) => (
                  <span key={s} className="flex items-center gap-2">
                    <SeverityBadge severity={s} /> {result.counts[s]}
                  </span>
                ))}
            </div>
          )}
        </Card>

        {result.preview && (
          <Card className="p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">{result.preview.title}</p>
              <SeverityBadge severity={result.preview.severity} />
            </div>
            <p className="mt-3 text-sm text-muted">{result.preview.explanation}</p>
            <div className="mt-4 space-y-3">
              {result.preview.evidence.map((e, i) => (
                <div key={i} className="rounded-md border-l-2 border-gold bg-paper/70 px-4 py-3">
                  <p className="text-xs font-medium text-muted">{result.preview!.chapterTitles[i] ?? `Section ${e.chapter_idx + 1}`}</p>
                  <p className="mt-1 font-serif text-[15px]">“{e.quote}”</p>
                </div>
              ))}
            </div>
            {result.preview.possible_intent && (
              <p className="mt-4 rounded-md bg-paper p-3 text-xs text-muted">
                <span className="font-medium text-ink">Could be intentional:</span> {result.preview.possible_intent}
              </p>
            )}
          </Card>
        )}

        {result.lockedTitles.length > 0 && (
          <div className="relative">
            <div className="space-y-2 blur-[3px]" aria-hidden>
              {result.lockedTitles.map((l, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-line bg-white px-4 py-3 text-sm">
                  <SeverityBadge severity={l.severity} /> <span className="capitalize">{l.category}</span> inconsistency — evidence in two chapters
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-ivory/70 text-center">
              <Lock className="h-5 w-5 text-gold" aria-hidden />
              <p className="mt-2 font-serif text-xl">See the full report</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Create a free account to see every issue, analyze 30,000 words, and build your Story Bible.</p>
              <ButtonLink href="/signup" className="mt-4">
                Create free account
              </ButtonLink>
            </div>
          </div>
        )}

        {result.lockedTitles.length === 0 && (
          <Card className="p-6 text-center">
            <p className="font-serif text-xl">Check the whole book.</p>
            <p className="mt-1 text-sm text-muted">Most continuity problems span distant chapters. Analyze your full manuscript free up to 30,000 words.</p>
            <ButtonLink href="/signup" className="mt-4">
              Create free account
            </ButtonLink>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-5 flex gap-2 text-sm" role="tablist">
        {(["upload", "paste"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-ink text-ivory" : "text-muted hover:bg-paper"}`}
          >
            {m === "upload" ? "Upload a file" : "Paste text"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-paper/50 px-6 py-14 text-center hover:border-gold">
          <Upload className="h-6 w-6 text-gold" aria-hidden />
          <span className="mt-3 font-medium">{file ? file.name : "Choose a DOCX, PDF or TXT file"}</span>
          <span className="mt-1 text-xs text-muted">We analyze the first 12,000 words. Nothing is stored.</span>
          <input type="file" accept=".docx,.pdf,.txt,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste at least 1,500 words — a few chapters works best…"
          className="min-h-[280px] w-full rounded-lg border border-line bg-white p-4 font-serif text-[15px] leading-relaxed outline-none focus:border-gold"
          aria-label="Manuscript text"
        />
      )}

      {error && <p className="mt-4 rounded-md bg-critical-soft px-4 py-3 text-sm text-critical">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Usually takes 1–3 minutes. Two free checks per day.</p>
        <Button onClick={run} disabled={state === "running" || (mode === "upload" ? !file : text.trim().length < 50)} variant="accent">
          {state === "running" ? "Reading your manuscript…" : "Analyze my manuscript"}
        </Button>
      </div>
    </Card>
  );
}
