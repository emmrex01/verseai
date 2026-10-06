import { requireUser } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { site } from "@/lib/site";

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("display_name, writing_type, writing_stage, created_at").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader title="Settings" />
      <Card className="divide-y divide-line">
        {[
          ["Name", profile?.display_name ?? "—"],
          ["Email", user.email ?? "—"],
          ["Writing", profile?.writing_type?.replace("_", " ") ?? "—"],
          ["Stage", profile?.writing_stage?.replace("_", " ") ?? "—"],
          ["Member since", profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-5 py-3.5 text-sm">
            <span className="text-muted">{k}</span>
            <span className="capitalize">{v}</span>
          </div>
        ))}
      </Card>
      <Card className="mt-6 p-6 text-sm">
        <h2 className="font-serif text-xl">Privacy</h2>
        <p className="mt-2 text-muted">Your writing is never used to train AI models. To delete a single book and all of its data, open the book and choose Book settings.</p>
        <p className="mt-2 text-muted">
          To delete your entire account, email <a className="underline" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> from {user.email}. We remove all data within 30 days.
        </p>
      </Card>
    </div>
  );
}
