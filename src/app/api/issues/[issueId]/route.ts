import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ status: z.enum(["open", "resolved", "dismissed"]) });

/** Authors resolve or dismiss issues. Dismissals persist across re-analysis. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/issues/[issueId]">) {
  const { issueId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const { data: issue, error } = await supabase
    .from("issues")
    .update({ status: parsed.data.status })
    .eq("id", issueId)
    .select("book_id, fingerprint")
    .maybeSingle();
  if (error || !issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });

  if (parsed.data.status === "dismissed") {
    await supabase.from("issue_dismissals").upsert({ book_id: issue.book_id, owner_id: auth.user.id, fingerprint: issue.fingerprint });
  } else {
    await supabase.from("issue_dismissals").delete().eq("book_id", issue.book_id).eq("fingerprint", issue.fingerprint);
  }
  return NextResponse.json({ ok: true });
}
