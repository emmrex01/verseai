import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy & Security",
  description: "How Verse protects unpublished manuscripts: private storage, encryption, account isolation, no AI training on your writing, and deletion on request.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="font-serif text-4xl">Privacy &amp; Security</h1>
      <p className="mt-4 text-lg text-muted">Your manuscript belongs to you. Here is exactly how we handle it.</p>
      <div className="mt-12 space-y-10 text-[15px] leading-relaxed">
        <Section title="We never train AI on your writing">
          Your manuscripts, Story Bible and questions are never used to train artificial intelligence models — by us or by our AI provider. Manuscript text is sent to our AI provider (Anthropic) only to
          perform the analysis you request, under commercial terms that prohibit training on customer content.
        </Section>
        <Section title="What we store">
          The original file you upload, the text of your manuscript split into chapters and paragraphs, and the analysis Verse produces (characters, places, timeline, issues and your questions). We also store
          your account details and billing status. Payment card details are handled by Stripe and never touch our servers.
        </Section>
        <Section title="How it is protected">
          All traffic is encrypted with TLS. Data is encrypted at rest. Every row of manuscript data is tied to your account and protected by database row-level security, so one account can never read
          another&apos;s content. Original files live in private storage that is not publicly accessible.
        </Section>
        <Section title="Deleting your data">
          Delete any book from its settings to permanently remove the manuscript, every version, the original files and all analysis. To delete your account entirely, contact us at {site.contactEmail} and we
          will remove all of your data within 30 days.
        </Section>
        <Section title="Free checker">
          The no-account free checker processes your text in memory to produce the report and does not store the text. We keep a salted hash of your IP address for 24-hour rate limiting.
        </Section>
        <Section title="Contact">Questions about privacy? Email {site.contactEmail}.</Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-3 text-muted">{children}</p>
    </section>
  );
}
