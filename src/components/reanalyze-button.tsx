"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export function ReanalyzeButton({ bookId, label = "Re-analyze" }: { bookId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/books/${bookId}/analyze`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) setMessage(data.message ?? data.error ?? "Couldn't start the analysis.");
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={run} disabled={busy}>
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden /> {label}
      </Button>
      {message && <p className="max-w-xs text-right text-xs text-critical">{message}</p>}
    </div>
  );
}
