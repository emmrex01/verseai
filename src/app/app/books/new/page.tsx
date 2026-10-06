import { requireUser } from "@/lib/supabase/server";
import { createBook } from "../../actions";
import { Button, ButtonLink, Card } from "@/components/ui";

const ERRORS: Record<string, string> = {
  invalid: "Please give your book a title.",
  limit: "You've reached the number of books on your plan.",
  save: "We couldn't create the book. Please try again.",
};

export default async function NewBookPage({ searchParams }: PageProps<"/app/books/new">) {
  await requireUser();
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Step 1 of 2</p>
      <h1 className="mt-2 font-serif text-4xl">Create your book</h1>
      <p className="mt-2 text-muted">Tell Verse a little about it. You can change this later.</p>
      {message && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-md bg-amber-soft px-4 py-3 text-sm text-amber">
          {message}
          {error === "limit" && (
            <ButtonLink href="/app/billing" size="sm" variant="secondary">
              Upgrade
            </ButtonLink>
          )}
        </div>
      )}
      <Card className="mt-8 p-6">
        <form action={createBook} className="space-y-5">
          <Field label="Book title" name="title" required placeholder="The Last Winter" />
          <fieldset>
            <legend className="text-sm text-muted">Type</legend>
            <div className="mt-2 flex gap-2">
              {[
                ["fiction", "Fiction"],
                ["nonfiction", "Non-fiction / memoir"],
              ].map(([v, l], i) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="inline-block rounded-md border border-line px-4 py-2 text-sm peer-checked:border-ink peer-checked:bg-paper">{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Genre" name="genre" placeholder="Mystery" />
            <Field label="Subgenre" name="subgenre" placeholder="Psychological thriller" />
          </div>
          <Field label="Target audience" name="audience" placeholder="Adult" />
          <Button type="submit" size="lg">
            Continue to upload
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, name, required, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input name={name} required={required} placeholder={placeholder} maxLength={200} className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 outline-none placeholder:text-muted/50 focus:border-gold" />
    </label>
  );
}
