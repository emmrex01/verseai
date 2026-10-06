"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";

const STEPS = [
  [3, "Reading manuscript"],
  [5, "Identifying chapters and scenes"],
  [40, "Mapping characters and places"],
  [62, "Understanding relationships"],
  [70, "Building character profiles"],
  [78, "Checking timeline and consistency"],
  [92, "Saving your Story Bible"],
] as const;

interface RunStatus {
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  progress: number;
  error: string | null;
  chapters_reused: number;
}

/** Polls an analysis run and refreshes the page when it finishes. */
export function AnalysisProgress({ runId, initial }: { runId: string; initial?: Partial<RunStatus> }) {
  const router = useRouter();
  const [run, setRun] = useState<RunStatus>({ status: "queued", stage: "Waiting to start", progress: 0, error: null, chapters_reused: 0, ...initial });

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (res.ok) {
          const data: RunStatus = await res.json();
          if (stopped) return;
          setRun(data);
          if (data.status === "succeeded" || data.status === "failed") {
            router.refresh();
            return;
          }
        }
      } catch {
        // transient network error: keep polling
      }
      if (!stopped) setTimeout(tick, 2500);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [runId, router]);

  if (run.status === "failed") {
    return (
      <Card className="border-critical/30 p-6">
        <p className="font-serif text-xl">The analysis didn&apos;t finish.</p>
        <p className="mt-2 text-sm text-muted">{run.error ?? "Something went wrong."} Your manuscript is saved — you can re-run the analysis from the overview.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6" aria-live="polite">
      <p className="font-serif text-2xl">{run.status === "succeeded" ? "Your book is ready." : "Building your book intelligence…"}</p>
      <p className="mt-1 text-sm text-muted">{run.status === "queued" ? "Queued — starting in a moment." : run.stage}. You can leave this page; we&apos;ll keep working.</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${Math.max(2, run.progress)}%` }} />
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {STEPS.map(([at, label], i) => {
          const nextAt = STEPS[i + 1]?.[0] ?? 100;
          const done = run.progress >= nextAt || run.status === "succeeded";
          const active = !done && run.progress >= at;
          return (
            <li key={label} className={done ? "text-ink" : active ? "text-ink" : "text-muted/60"}>
              <span className="inline-flex w-5">{done ? <Check className="h-4 w-4 text-sage" aria-hidden /> : active ? <Loader2 className="h-4 w-4 animate-spin text-gold" aria-hidden /> : null}</span>
              {label}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
