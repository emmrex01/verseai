"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

async function go(path: string, body?: object) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (data.url) window.location.assign(data.url);
  else throw new Error(data.error ?? "Billing is unavailable right now.");
}

export function CheckoutButton({ plan, interval, label, variant = "primary" }: { plan: string; interval: "month" | "year"; label: string; variant?: "primary" | "secondary" | "accent" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={variant}
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await go("/api/billing/checkout", { plan, interval });
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening checkout…" : label}
      </Button>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
    </div>
  );
}

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await go("/api/billing/portal");
        } catch {
          setBusy(false);
        }
      }}
    >
      Manage billing &amp; invoices
    </Button>
  );
}
