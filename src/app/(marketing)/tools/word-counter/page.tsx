import type { Metadata } from "next";
import { WordCounter } from "@/components/tools/word-counter";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: "Free Manuscript Word Counter — Pages, Reading Time & Genre Length",
  description: "Paste your manuscript to count words, estimate print pages and reading time, and compare your length with typical word counts for your genre. Free, private, no sign-up.",
  alternates: { canonical: "/tools/word-counter" },
};

const RANGES: [string, string][] = [
  ["Romance", "70,000–90,000"],
  ["Mystery & thriller", "70,000–90,000"],
  ["Fantasy & science fiction", "90,000–120,000"],
  ["Literary fiction", "80,000–100,000"],
  ["Young adult", "55,000–80,000"],
  ["Middle grade", "30,000–55,000"],
  ["Memoir", "70,000–90,000"],
  ["Non-fiction", "50,000–80,000"],
];

export default function WordCounterPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd({ "@context": "https://schema.org", "@type": "WebApplication", name: "Verse Manuscript Word Counter", applicationCategory: "UtilitiesApplication", offers: { "@type": "Offer", price: 0, priceCurrency: "USD" } })} />
      <Eyebrow>Free tool</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl">Manuscript word counter</h1>
      <p className="mt-3 text-muted">Paste a chapter or your whole book. Your text never leaves your browser.</p>
      <div className="mt-8">
        <WordCounter ranges={RANGES} />
      </div>
      <section className="mt-16">
        <h2 className="font-serif text-2xl">How long should a novel be?</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Publishers and agents expect manuscripts within typical ranges for each genre. Debut novels far outside these ranges can be harder to sell, though the right length is ultimately the one your story
          needs. Use these as guidelines, not rules.
        </p>
        <table className="mt-6 w-full text-sm">
          <tbody className="divide-y divide-line border-y border-line">
            {RANGES.map(([g, r]) => (
              <tr key={g}>
                <td className="py-2.5">{g}</td>
                <td className="py-2.5 text-right text-muted">{r} words</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="mt-14 rounded-lg border border-line bg-paper/60 p-6">
        <p className="font-serif text-xl">Word count is the easy part.</p>
        <p className="mt-2 text-sm text-muted">Verse reads your whole manuscript and finds continuity errors, plot holes and pacing problems — with the passages to prove it.</p>
        <ButtonLink href="/signup" className="mt-4">
          Analyze my manuscript free
        </ButtonLink>
      </div>
    </div>
  );
}
