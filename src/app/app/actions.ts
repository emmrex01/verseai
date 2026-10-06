"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPlan } from "@/lib/billing/usage";

const Onboarding = z.object({
  writing_type: z.enum(["fiction", "nonfiction", "memoir", "poetry", "childrens", "other"]),
  writing_stage: z.enum(["planning", "first_draft", "revising", "final", "publishing", "marketing"]),
});

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = Onboarding.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/welcome?error=1");
  await supabase.from("profiles").update({ ...parsed.data, onboarded_at: new Date().toISOString() }).eq("id", user.id);
  redirect("/app/books/new");
}

const NewBook = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(["fiction", "nonfiction"]),
  genre: z.string().trim().max(80).optional(),
  subgenre: z.string().trim().max(80).optional(),
  audience: z.string().trim().max(80).optional(),
});

export async function createBook(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = NewBook.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/app/books/new?error=invalid");

  const plan = await getUserPlan(supabase, user.id);
  if (plan.books !== null) {
    const { count } = await supabase.from("books").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= plan.books) redirect("/app/books/new?error=limit");
  }

  const { data, error } = await supabase
    .from("books")
    .insert({ owner_id: user.id, ...parsed.data, genre: parsed.data.genre || null, subgenre: parsed.data.subgenre || null, audience: parsed.data.audience || null })
    .select("id")
    .single();
  if (error) redirect("/app/books/new?error=save");
  redirect(`/app/books/${data.id}/upload`);
}

/** Permanently delete a book, every version, original files and all analysis. */
export async function deleteBook(formData: FormData) {
  const { supabase, user } = await requireUser();
  const bookId = String(formData.get("bookId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const { data: book } = await supabase.from("books").select("id, title").eq("id", bookId).maybeSingle();
  if (!book) redirect("/app");
  if (confirm.trim() !== book.title.trim()) redirect(`/app/books/${bookId}/settings?error=confirm`);

  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("manuscripts").list(`${user.id}/${bookId}`);
  if (files?.length) await admin.storage.from("manuscripts").remove(files.map((f) => `${user.id}/${bookId}/${f.name}`));
  // Cascades remove versions, chapters, paragraphs, runs, Story Bible and issues.
  await admin.from("books").delete().eq("id", bookId).eq("owner_id", user.id);
  redirect("/app?deleted=1");
}
