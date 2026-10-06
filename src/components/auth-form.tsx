"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";

function safeNext(value: string | null, fallback: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const plan = params.get("plan");
  const next = safeNext(params.get("next"), plan ? `/app/billing?plan=${encodeURIComponent(plan)}` : "/app");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in failed. Please try again." : null);
  const [notice, setNotice] = useState<string | null>(null);

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
      if (error) setError(error.message);
      else if (!data.session) setNotice("Check your email to confirm your account, then come back here.");
      else window.location.assign(next);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("That email and password don't match.");
      else window.location.assign(next);
    }
    setBusy(false);
  }

  return (
    <Card className="p-7">
      <h1 className="font-serif text-2xl">{mode === "signup" ? "Create your free account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted">{mode === "signup" ? "Analyze your first 30,000 words free. No card needed." : "Sign in to your workspace."}</p>

      <Button variant="secondary" className="mt-6 w-full" onClick={google} disabled={busy} type="button">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
        </svg>
        Continue with Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-gold" />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-gold"
          />
        </label>
        {error && <p className="text-sm text-critical">{error}</p>}
        {notice && <p className="text-sm text-sage">{notice}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/login${params.toString() ? `?${params}` : ""}`} className="text-ink underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Verse?{" "}
            <Link href={`/signup${params.toString() ? `?${params}` : ""}`} className="text-ink underline">
              Create a free account
            </Link>
          </>
        )}
      </p>
      {mode === "signup" && (
        <p className="mt-4 text-center text-xs text-muted">
          By continuing you agree to the <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy policy</Link>.
        </p>
      )}
    </Card>
  );
}
