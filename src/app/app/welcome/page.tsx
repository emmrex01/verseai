import { requireUser } from "@/lib/supabase/server";
import { completeOnboarding } from "../actions";
import { Button, Card } from "@/components/ui";

const TYPES: [string, string][] = [
  ["fiction", "Fiction"],
  ["nonfiction", "Non-fiction"],
  ["memoir", "Memoir"],
  ["poetry", "Poetry"],
  ["childrens", "Children's book"],
  ["other", "Other"],
];
const STAGES: [string, string][] = [
  ["planning", "Planning"],
  ["first_draft", "First draft"],
  ["revising", "Revising"],
  ["final", "Final manuscript"],
  ["publishing", "Publishing"],
  ["marketing", "Marketing"],
];

export default async function WelcomePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-serif text-4xl">Welcome to Verse.</h1>
      <p className="mt-2 text-muted">Two quick questions so we can set up your workspace.</p>
      <form action={completeOnboarding} className="mt-10 space-y-10">
        <Choice name="writing_type" label="What are you writing?" options={TYPES} />
        <Choice name="writing_stage" label="Where are you in your writing journey?" options={STAGES} />
        <Button type="submit" size="lg">
          Continue
        </Button>
      </form>
    </div>
  );
}

function Choice({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return (
    <fieldset>
      <legend className="font-serif text-xl">{label}</legend>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map(([value, text], i) => (
          <label key={value} className="cursor-pointer">
            <input type="radio" name={name} value={value} defaultChecked={i === 0} className="peer sr-only" required />
            <Card className="px-4 py-3 text-sm peer-checked:border-ink peer-checked:bg-paper peer-focus-visible:outline-2 peer-focus-visible:outline-gold">{text}</Card>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
