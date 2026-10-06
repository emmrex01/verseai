"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button, ButtonLink, Card } from "@/components/ui";

interface UploadResult {
  words: number;
  chapters: number;
  chaptersDetected: boolean;
  analysis: { ok: true; runId: string } | { ok: false; reason: string; message: string };
}

export function ManuscriptUpload({ bookId, compact }: { bookId: string; compact?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`/api/books/${bookId}/manuscript`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const result = data as UploadResult;
      if (!result.analysis.ok && result.analysis.reason !== "in_progress") {
        setBlocked(result.analysis.message);
        setBusy(false);
        return;
      }
      router.push(`/app/books/${bookId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setBusy(false);
    }
  }

  if (blocked) {
    return (
      <Card className="p-6">
        <p className="font-serif text-xl">Your manuscript is saved.</p>
        <p className="mt-2 text-sm text-muted">{blocked}</p>
        <div className="mt-5 flex gap-2">
          <ButtonLink href="/app/billing" variant="accent">
            See plans
          </ButtonLink>
          <ButtonLink href={`/app/books/${bookId}/manuscript`} variant="secondary">
            Read manuscript
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          setFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-white px-6 text-center transition-colors ${compact ? "py-8" : "py-16"} ${dragging ? "border-gold bg-gold-soft/40" : "border-line hover:border-gold"}`}
      >
        <Upload className="h-6 w-6 text-gold" aria-hidden />
        <span className="mt-3 font-medium">{file ? file.name : "Drop your manuscript here, or choose a file"}</span>
        <span className="mt-1 text-xs text-muted">DOCX (best), PDF, TXT or Markdown · up to 4 MB</span>
        <input type="file" accept=".docx,.pdf,.txt,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {error && <p className="mt-3 rounded-md bg-critical-soft px-4 py-3 text-sm text-critical">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Unchanged chapters from earlier versions are re-used, not re-billed.</p>
        <Button onClick={upload} disabled={!file || busy}>
          {busy ? "Reading your file…" : "Upload & analyze"}
        </Button>
      </div>
    </div>
  );
}
