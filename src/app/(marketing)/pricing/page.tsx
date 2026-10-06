import type { Metadata } from "next";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Verse plans for authors: start free with 30,000 words, then $15/month for one book in progress or $39/month for working authors. Re-analyzing unchanged chapters is always free.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-14 text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Less than a single hour of editing.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Every plan includes the full Story Bible, consistency checking with evidence, and Ask Your Book. Plans differ by how many words Verse analyzes for you each month.
        </p>
      </div>
      <PricingTable />
      <div className="mx-auto mt-16 max-w-3xl rounded-lg border border-line bg-paper/60 p-6 text-sm text-muted">
        <p className="font-medium text-ink">How word allowances work</p>
        <p className="mt-2">
          Your allowance counts words Verse reads for the first time. When you upload a revision, chapters you didn&apos;t change reuse their analysis and don&apos;t count again — so revising
          an 80,000-word novel where you rewrote five chapters only uses the words in those five chapters.
        </p>
      </div>
      <div className="mx-auto mt-20 max-w-4xl">
        <h2 className="mb-8 font-serif text-3xl">Frequently asked</h2>
        <Faq />
      </div>
    </div>
  );
}
