import type { Metadata } from "next";
import { ConsistencyChecker } from "@/components/tools/consistency-checker";
import { Eyebrow } from "@/components/ui";
import { jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Plot Hole & Consistency Checker for Novels",
  description:
    "Upload up to 12,000 words of your manuscript and find continuity errors, character inconsistencies and timeline problems — with quotes from your text as evidence. Free, no sign-up.",
  alternates: { canonical: "/tools/consistency-checker" },
};

export default function ConsistencyCheckerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Verse Plot Hole & Consistency Checker", applicationCategory: "UtilitiesApplication", offers: { "@type": "Offer", price: 0, priceCurrency: "USD" } })} />
      <Eyebrow>Free tool</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Find the story problems you can&apos;t see yourself.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Upload a few chapters — up to 12,000 words. Verse maps your characters, places and events, then checks them against each other for contradictions. Every issue comes with the passages behind it.
      </p>
      <div className="mt-10">
        <ConsistencyChecker />
      </div>
      <section className="mt-20 grid gap-10 text-sm leading-relaxed text-muted md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl text-ink">What counts as a plot hole?</h2>
          <p className="mt-3">
            A plot hole is anything in the story that contradicts what the story has already established: a character who knows something they couldn&apos;t, an event that happens before its cause, a
            detail that changes without explanation. They are almost impossible to catch in your own work because you know what you meant.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-2xl text-ink">What the checker looks for</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Character ages, appearance and backstory that change</li>
            <li>Relationships described two different ways</li>
            <li>Timeline and date impossibilities</li>
            <li>Objects in two places or owned by two people</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
