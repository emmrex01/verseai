import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { site } from "@/lib/site";

const nav = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/tools/consistency-checker", label: "Free checker" },
  { href: "/pricing", label: "Pricing" },
];

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex" aria-label="Main">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 text-sm text-muted hover:text-ink sm:inline">
              Sign in
            </Link>
            <ButtonLink href="/signup" size="sm">
              Analyze my book
            </ButtonLink>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-paper/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-muted">Your book. Understood.</p>
            <p className="mt-2 text-xs text-muted">Your manuscript stays yours. We never train AI on your writing.</p>
          </div>
          <FooterCol title="Product" links={[["Features", "/#features"], ["Pricing", "/pricing"], ["Security & privacy", "/privacy"]]} />
          <FooterCol title="Free tools" links={[["Plot hole & consistency checker", "/tools/consistency-checker"], ["Manuscript word counter", "/tools/word-counter"]]} />
          <FooterCol title="Company" links={[["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", `mailto:${site.contactEmail}`]]} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">© {new Date().getFullYear()} Verse. All rights reserved.</div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
