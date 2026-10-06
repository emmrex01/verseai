import type { Metadata } from "next";
import { BookOpen, Clock, Lock, MapPin, MessagesSquare, Network, ScrollText, Users } from "lucide-react";
import { ButtonLink, Card, Eyebrow, SeverityBadge } from "@/components/ui";
import { PricingTable } from "@/components/marketing/pricing-table";
import { Faq } from "@/components/marketing/faq";
import { PLANS } from "@/lib/plans";
import { env } from "@/lib/env";
import { jsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Verse — AI Manuscript Editor & Story Bible for Authors" },
  description:
    "Verse reads your whole manuscript and builds a Story Bible of characters, places and timeline — then finds plot holes and consistency errors with evidence from your text. Free to start.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const schema = [
    { "@context": "https://schema.org", "@type": "Organization", name: "Verse", url: env.siteUrl(), logo: `${env.siteUrl()}/icon.png` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Verse", url: env.siteUrl() },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Verse",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "AI editorial workspace for authors: Story Bible, consistency and plot hole detection, pacing analysis and Ask Your Book.",
      offers: Object.values(PLANS).map((p) => ({ "@type": "Offer", name: p.name, price: p.monthly, priceCurrency: "USD" })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 [&>*]:min-w-0">
        <div>
          <Eyebrow>The AI editorial workspace for authors</Eyebrow>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Your book.
            <br />
            Understood.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Verse reads your entire manuscript, remembers every character, maps your timeline, and finds the story problems you can&apos;t see yourself — before your readers do.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup" size="lg">
              Analyze my book — free
            </ButtonLink>
            <ButtonLink href="#how-it-works" size="lg" variant="secondary">
              See how Verse works
            </ButtonLink>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden /> Private by default. Never used to train AI.
          </p>
        </div>
        <HeroDashboard />
      </section>

      {/* Problem */}
      <section className="border-y border-line bg-paper/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">Your manuscript holds more than anyone can keep in their head.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              ["80,000 words", "A typical novel. Hundreds of details about ages, places, dates and who knows what — spread across months of drafting."],
              ["Dozens of characters", "Each with a history, a voice and relationships that have to hold together from the first chapter to the last."],
              ["Thousands of dollars", "What a developmental edit costs. Verse gives you an editor's eye on continuity and structure before you spend it."],
            ].map(([title, body]) => (
              <div key={title}>
                <p className="font-serif text-2xl text-burgundy">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Eyebrow>One book. One intelligent workspace.</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl sm:text-4xl">Upload a manuscript. Get a living Story Bible.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {[
            [BookOpen, "Manuscript", "Chapters and scenes detected automatically. Every finding links to the exact paragraph."],
            [Users, "Characters", "Profiles built from your text: goals, fears, appearance, arc — and every chapter they appear in."],
            [Clock, "Timeline", "Events in story order with their time markers, so you can see when things happen."],
            [MapPin, "Locations & objects", "Every place and important object, with what your text says about each."],
            [Network, "Relationships", "Who is connected to whom, and how — with the passages that establish it."],
            [ScrollText, "Plot threads", "Setups, mysteries and promises — and the ones you never paid off."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof BookOpen;
            return (
              <div key={title as string} className="bg-white p-7">
                <I className="h-5 w-5 text-gold" aria-hidden />
                <h3 className="mt-4 font-serif text-xl">{title as string}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contradictions */}
      <FeatureRow
        eyebrow="Consistency"
        title="Find problems before your readers do."
        body="Verse compares every fact your manuscript states — ages, dates, backstory, descriptions, who owns what — and flags the ones that conflict. Each issue shows the passages side by side and notes whether it might be intentional. You stay in control."
        visual={
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Sarah&apos;s history with Paris</p>
              <SeverityBadge severity="high" />
            </div>
            <p className="mt-3 text-sm text-muted">Potential inconsistency · Character background</p>
            <div className="mt-5 space-y-3">
              <Quote ch="Chapter 8" text="“I’ve never been to Paris,” Sarah said, turning the postcard over." />
              <Quote ch="Chapter 31" text="Two years in that Montmartre flat had taught her to ignore the bells." />
            </div>
            <p className="mt-4 rounded-md bg-paper p-3 text-xs text-muted">
              <span className="font-medium text-ink">Could be intentional:</span> if Sarah is lying in Chapter 8, consider letting another character notice.
            </p>
          </Card>
        }
      />

      {/* Characters */}
      <FeatureRow
        reverse
        eyebrow="Character intelligence"
        title="Know every character as well as you know your protagonist."
        body="Verse builds a profile for each character from what your text actually says — never invented. See their goals, fears and arc, every chapter they appear in, and the relationships that connect them."
        visual={
          <Card className="p-6">
            <p className="font-serif text-2xl tracking-wide">SARAH MITCHELL</p>
            <p className="text-sm text-gold">Protagonist · 23 chapters</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <ProfileField label="Goal" value="Find her missing brother" />
              <ProfileField label="Fear" value="Being abandoned again" />
              <ProfileField label="Arc" value="Isolation → Trust → Leadership" />
              <ProfileField label="First appears" value="Chapter 1" />
            </dl>
            <div className="mt-5 border-t border-line pt-4 text-sm">
              {[
                ["Daniel Reyes", "Romantic tension"],
                ["Michael Mitchell", "Brother"],
                ["Helen Mitchell", "Mother"],
              ].map(([n, r]) => (
                <div key={n} className="flex justify-between py-1">
                  <span>{n}</span>
                  <span className="text-muted">{r}</span>
                </div>
              ))}
            </div>
          </Card>
        }
      />

      {/* Pacing */}
      <FeatureRow
        eyebrow="Pacing"
        title="See how your story moves."
        body="Tension, conflict and emotional movement for every chapter, plus where the turning points fall. Verse suggests where momentum may sag — as a recommendation, never a formula."
        visual={
          <Card className="p-6">
            <p className="text-sm font-medium">Story momentum by chapter</p>
            <div className="mt-5 flex h-40 items-end gap-1.5" aria-hidden>
              {[6, 7, 5, 3, 2, 6, 7, 8, 6, 5, 7, 9, 8, 4, 7, 9].map((v, i) => (
                <div key={i} className={`flex-1 rounded-t ${v <= 3 ? "bg-burgundy/70" : "bg-gold/80"}`} style={{ height: `${v * 10}%` }} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">Chapters 4–5 have noticeably less conflict and movement than the chapters around them.</p>
          </Card>
        }
      />

      {/* Ask */}
      <FeatureRow
        reverse
        eyebrow="Ask your book"
        title="Ask your book anything. Get answers with receipts."
        body="“What does Sarah know about Daniel by Chapter 12?” Verse answers from your manuscript only, says plainly when the text doesn't establish something, and cites the passages behind every answer."
        visual={
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <MessagesSquare className="mt-0.5 h-4 w-4 text-gold" aria-hidden />
              <p className="text-sm font-medium">What does Sarah know about Daniel by Chapter 12?</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Sarah knows Daniel was at the station the night Michael disappeared (Ch 4) and that he lied about it (Ch 8). The manuscript does not establish that she suspects he was involved.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {["Chapter 4", "Chapter 8", "Chapter 12"].map((c) => (
                <span key={c} className="rounded border border-line px-2 py-1 text-muted">
                  {c}
                </span>
              ))}
            </div>
          </Card>
        }
      />

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-ink text-ivory">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">How it works</p>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl">From draft to clarity in minutes.</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              ["Upload your manuscript", "DOCX, PDF or plain text. Verse detects your chapters and scenes and keeps your formatting out of the way."],
              ["Verse reads the whole book", "It maps characters, places, relationships, events and story threads, then checks them against each other."],
              ["Revise with evidence", "Work through issues ranked by severity, jump straight to the passage, and re-analyze only what changed."],
            ].map(([t, b], i) => (
              <li key={t}>
                <span className="font-serif text-4xl text-gold">{i + 1}</span>
                <h3 className="mt-3 font-serif text-xl">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ivory/70">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <Eyebrow>Privacy</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl">Your stories stay yours.</h2>
          </div>
          <ul className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Never used for training", "Your writing is never used to train AI models — ours or anyone's."],
              ["Isolated & encrypted", "Encrypted in transit and at rest, with database-level isolation between accounts."],
              ["Private file storage", "Original files are stored in private storage, visible only to you."],
              ["Delete anytime", "Delete a book and every piece of its analysis with one click."],
            ].map(([t, b]) => (
              <li key={t} className="rounded-lg border border-line bg-white p-5">
                <p className="font-medium">{t}</p>
                <p className="mt-1 text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-y border-line bg-paper/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-serif text-3xl">Built for authors writing full-length books.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Independent authors", "Get an editor's eye on continuity and structure before you pay for a developmental edit — or instead of one."],
              ["Series writers", "Keep ten books of characters, ages and world details straight without a spreadsheet."],
              ["Memoir & non-fiction", "Track the real people, places and dates in your story, and the claims you've promised to explain."],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="font-serif text-xl">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mb-12 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl">Start free. Upgrade when your book does.</h2>
          <p className="mt-3 text-sm text-muted">Re-analyzing unchanged chapters is always free.</p>
        </div>
        <PricingTable />
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <h2 className="mb-8 font-serif text-3xl">Questions authors ask</h2>
        <Faq />
      </section>

      {/* Final CTA */}
      <section className="border-t border-line bg-paper/60">
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="font-serif text-4xl">Your story deserves to be understood.</h2>
          <p className="mt-4 text-muted">Upload your manuscript and see what Verse finds. Free for your first 30,000 words.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" size="lg">
              Analyze my book
            </ButtonLink>
            <ButtonLink href="/tools/consistency-checker" size="lg" variant="secondary">
              Try the free checker
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function HeroDashboard() {
  return (
    <div className="relative">
      <p className="absolute -top-6 right-0 text-[11px] uppercase tracking-[0.16em] text-muted">Example analysis</p>
      <Card className="p-6 shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)]">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <p className="font-serif text-2xl tracking-wide">THE LAST WINTER</p>
            <p className="text-sm text-muted">Mystery · 82,400 words · 31 chapters</p>
          </div>
          <span className="rounded bg-sage-soft px-2 py-1 text-xs font-medium text-sage">Analyzed</span>
        </div>
        <div className="grid grid-cols-3 gap-4 border-b border-line py-5 text-center">
          {[
            ["17", "Characters"],
            ["9", "Locations"],
            ["43", "Timeline events"],
          ].map(([n, l]) => (
            <div key={l}>
              <p className="font-serif text-3xl">{n}</p>
              <p className="text-xs text-muted">{l}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2.5 pt-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Needs attention</p>
          {[
            ["high", "Sarah's history with Paris", "Ch 8 · Ch 31"],
            ["high", "The letter arrives before it is sent", "Ch 12 · Ch 14"],
            ["medium", "Who took the photograph? — never resolved", "Ch 3"],
            ["low", "Chapter 14 slows noticeably", "Ch 14"],
          ].map(([s, t, c]) => (
            <div key={t} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <SeverityBadge severity={s as "high"} />
                <span className="truncate">{t}</span>
              </div>
              <span className="shrink-0 text-xs text-muted">{c}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FeatureRow({ eyebrow, title, body, visual, reverse }: { eyebrow: string; title: string; body: string; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className={`grid items-center gap-12 md:grid-cols-2 [&>*]:min-w-0 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
          <p className="mt-4 leading-relaxed text-muted">{body}</p>
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

function Quote({ ch, text }: { ch: string; text: string }) {
  return (
    <div className="rounded-md border-l-2 border-gold bg-paper/70 px-4 py-3">
      <p className="text-xs font-medium text-muted">{ch}</p>
      <p className="mt-1 font-serif text-[15px] leading-relaxed">{text}</p>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
