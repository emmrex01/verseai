"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function IssueActions({ issueId, status }: { issueId: string; status: "open" | "resolved" | "dismissed" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(next: "open" | "resolved" | "dismissed") {
    setBusy(true);
    await fetch(`/api/issues/${issueId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    router.refresh();
    setBusy(false);
  }
  if (status !== "open") {
    return (
      <Button size="sm" variant="ghost" onClick={() => set("open")} disabled={busy}>
        Reopen
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => set("resolved")} disabled={busy}>
        Mark fixed
      </Button>
      <Button size="sm" variant="ghost" onClick={() => set("dismissed")} disabled={busy} title="Intentional — don't flag this again">
        It&apos;s intentional
      </Button>
    </div>
  );
}
