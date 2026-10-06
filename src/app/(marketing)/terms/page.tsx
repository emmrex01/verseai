import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h1 className="font-serif text-4xl">Terms of Service</h1>
      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-muted">
        <p>
          <strong className="text-ink">You own your work.</strong> You keep all rights to everything you upload and everything Verse generates about it. You grant Verse only the limited permission needed to
          store and process your manuscript to provide the service to you.
        </p>
        <p>
          <strong className="text-ink">Verse is an editorial aid.</strong> Analysis is generated automatically and can be wrong. Issues are presented as potential problems for you to judge; Verse does not
          guarantee that a manuscript is free of errors or ready for publication.
        </p>
        <p>
          <strong className="text-ink">Acceptable use.</strong> Upload only content you have the right to use. Don&apos;t attempt to access other users&apos; data, resell the service, or overload it.
        </p>
        <p>
          <strong className="text-ink">Subscriptions.</strong> Paid plans renew automatically each month or year until cancelled. You can cancel at any time from the billing page; access continues until the
          end of the paid period. Monthly word and question allowances reset on the first day of each calendar month (UTC) and do not roll over.
        </p>
        <p>
          <strong className="text-ink">Contact.</strong> {site.contactEmail}
        </p>
      </div>
    </article>
  );
}
