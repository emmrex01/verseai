import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManuscriptParseError, extensionOf, parseManuscript } from "@/lib/manuscript/parse";
import { structureManuscript } from "@/lib/manuscript/structure";
import { queueAnalysis } from "@/lib/analysis/queue";

export const maxDuration = 120;

const INSERT_CHUNK = 500;

/** Upload a new manuscript version: parse, store structure, queue analysis. */
export async function POST(request: Request, ctx: RouteContext<"/api/books/[bookId]/manuscript">) {
  const { bookId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to upload a manuscript." }, { status: 401 });
  const user = auth.user;

  // RLS guarantees this only returns the user's own book.
  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const ext = extensionOf(file.name);
  if (!ext) return NextResponse.json({ error: "Upload a .docx, .pdf, .txt or .md file." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let structured;
  try {
    structured = structureManuscript(await parseManuscript(buffer, file.name));
  } catch (err) {
    const message = err instanceof ManuscriptParseError ? err.message : "We couldn't read this file. Try saving it as .docx and uploading again.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
  if (structured.wordCount < 200) {
    return NextResponse.json({ error: "This file has fewer than 200 words. Upload at least a full chapter." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: last } = await admin
    .from("manuscript_versions")
    .select("version_no")
    .eq("book_id", bookId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNo = (last?.version_no ?? 0) + 1;

  const storagePath = `${user.id}/${bookId}/v${versionNo}.${ext}`;
  const { error: storageErr } = await admin.storage
    .from("manuscripts")
    .upload(storagePath, buffer, { contentType: file.type || "application/octet-stream", upsert: true });

  const { data: version, error: vErr } = await admin
    .from("manuscript_versions")
    .insert({
      book_id: bookId,
      owner_id: user.id,
      version_no: versionNo,
      source_filename: file.name.slice(0, 200),
      storage_path: storageErr ? null : storagePath,
      word_count: structured.wordCount,
      chapter_count: structured.chapters.length,
    })
    .select("id")
    .single();
  if (vErr) return NextResponse.json({ error: "Could not save the manuscript." }, { status: 500 });

  const chapterRows = structured.chapters.map((c, idx) => ({
    id: crypto.randomUUID(),
    version_id: version.id,
    book_id: bookId,
    owner_id: user.id,
    idx,
    title: c.title.slice(0, 200),
    word_count: c.wordCount,
    scene_count: c.sceneCount,
    content_hash: c.contentHash,
  }));
  const { error: cErr } = await admin.from("chapters").insert(chapterRows);
  if (cErr) return NextResponse.json({ error: "Could not save chapters." }, { status: 500 });

  const paragraphRows = structured.chapters.flatMap((c, ci) =>
    c.paragraphs.map((p, idx) => ({
      chapter_id: chapterRows[ci].id,
      book_id: bookId,
      owner_id: user.id,
      idx,
      scene_idx: p.sceneIdx,
      text: p.text,
    })),
  );
  for (let i = 0; i < paragraphRows.length; i += INSERT_CHUNK) {
    const { error } = await admin.from("paragraphs").insert(paragraphRows.slice(i, i + INSERT_CHUNK));
    if (error) return NextResponse.json({ error: "Could not save manuscript text." }, { status: 500 });
  }

  await admin.from("books").update({ current_version_id: version.id, updated_at: new Date().toISOString() }).eq("id", bookId);

  const queued = await queueAnalysis(supabase, admin, user.id, bookId);
  return NextResponse.json({
    versionId: version.id,
    words: structured.wordCount,
    chapters: structured.chapters.length,
    chaptersDetected: structured.chaptersDetected,
    analysis: queued,
  });
}
