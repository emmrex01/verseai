import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export interface Book {
  id: string;
  title: string;
  genre: string | null;
  subgenre: string | null;
  kind: "fiction" | "nonfiction";
  audience: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  progress: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  chapters_reused: number;
  words_billed: number;
  version_id: string;
  chapter_limit: number | null;
}

export async function getBook(supabase: SupabaseClient, bookId: string): Promise<Book> {
  const { data } = await supabase.from("books").select("*").eq("id", bookId).maybeSingle();
  if (!data) notFound();
  return data as Book;
}

export async function getRuns(supabase: SupabaseClient, bookId: string) {
  const { data } = await supabase
    .from("analysis_runs")
    .select("id, status, stage, progress, error, created_at, finished_at, chapters_reused, words_billed, version_id, chapter_limit")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false })
    .limit(10);
  const runs = (data ?? []) as Run[];
  return {
    latest: runs[0] ?? null,
    active: runs.find((r) => r.status === "queued" || r.status === "running") ?? null,
    lastSucceeded: runs.find((r) => r.status === "succeeded") ?? null,
  };
}

export async function getVersion(supabase: SupabaseClient, versionId: string | null) {
  if (!versionId) return null;
  const { data } = await supabase.from("manuscript_versions").select("id, version_no, source_filename, word_count, chapter_count, created_at").eq("id", versionId).maybeSingle();
  return data;
}

export const chapterLabel = (idx: number) => `Ch ${idx + 1}`;
