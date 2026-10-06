"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";

export function GenerateReportButton({ bookId, label = "Generate editorial report" }: { bookId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade: boolean } | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="accent"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/books/${bookId}/report`, { method: "POST" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) setError({ message: data.message ?? data.error ?? "Couldn't start the report.", upgrade: data.reason === "quota" });
          router.refresh();
          setBusy(false);
        }}
      >
        <FileText className="h-4 w-4" aria-hidden /> {busy ? "Starting…" : label}
      </Button>
      {error && (
        <div className="flex items-center gap-3 text-sm text-critical">
          {error.message}
          {error.upgrade && (
            <ButtonLink href="/app/billing" size="sm" variant="secondary">
              Upgrade
            </ButtonLink>
          )}
        </div>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden /> Download PDF
    </Button>
  );
}
