import { jsonLd } from "@/lib/site";

export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Does Verse write my book for me?",
    a: "No. Verse is an editorial workspace, not a ghostwriter. It reads your manuscript, builds a Story Bible, and points out potential problems with evidence from your own text. Every creative decision stays yours.",
  },
  {
    q: "Is my manuscript private?",
    a: "Yes. Your manuscript is stored privately, isolated to your account with row-level security, and encrypted in transit and at rest. We never use your writing to train AI models, and you can delete a book and all of its analysis at any time.",
  },
  {
    q: "How accurate is the consistency checking?",
    a: "Verse is tuned for precision: every issue cites the exact passages it is based on, and quotes are verified against your manuscript before you see them. Issues are framed as potential inconsistencies with a note on whether they might be intentional — you decide. Dismissed issues stay dismissed when you re-analyze.",
  },
  {
    q: "What file types can I upload?",
    a: "DOCX (recommended — chapter headings from Word styles are detected automatically), text-based PDF, TXT and Markdown. Scanned PDFs are not supported yet.",
  },
  {
    q: "What happens when I revise my book?",
    a: "Upload the new version. Verse recognizes unchanged chapters and reuses their analysis, so only the chapters you changed count toward your monthly word allowance.",
  },
  {
    q: "Does it work for non-fiction?",
    a: "Yes. Verse tracks the people, places and organizations in memoir, biography and non-fiction, maps your timeline, and flags conflicting claims and promised explanations that are never delivered.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month (or yearly with two months free) and you can cancel from your billing page. You keep access until the end of the period.",
  },
];

export function Faq() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="divide-y divide-line border-y border-line">
      {FAQ_ITEMS.map((f) => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-lg">
            {f.q}
            <span className="text-gold transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
    </div>
  );
}
