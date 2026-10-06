"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BookOpen, Clock, FileText, Gauge, LayoutDashboard, MapPin, MessagesSquare, Network, Settings, ShieldAlert, Users } from "lucide-react";

const SECTIONS = [
  {
    label: "Book",
    items: [
      ["", "Overview", LayoutDashboard],
      ["/manuscript", "Manuscript", BookOpen],
    ],
  },
  {
    label: "Story Bible",
    items: [
      ["/characters", "Characters", Users],
      ["/locations", "Places & objects", MapPin],
      ["/relationships", "Relationships", Network],
      ["/timeline", "Timeline", Clock],
    ],
  },
  {
    label: "Analyze",
    items: [
      ["/issues", "Consistency", ShieldAlert],
      ["/pacing", "Pacing", Gauge],
      ["/ask", "Ask your book", MessagesSquare],
      ["/report", "Editorial report", FileText],
    ],
  },
] as const;

export function BookNav({ bookId, title, openIssues }: { bookId: string; title: string; openIssues: number }) {
  const pathname = usePathname();
  const base = `/app/books/${bookId}`;
  return (
    <nav aria-label="Book" className="text-sm">
      <p className="mb-6 truncate px-3 font-serif text-lg" title={title}>
        {title}
      </p>
      {SECTIONS.map((s) => (
        <div key={s.label} className="mb-6">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{s.label}</p>
          {s.items.map(([path, label, Icon]) => {
            const href = base + path;
            const active = path === "" ? pathname === base : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={clsx("flex items-center gap-2.5 rounded-md px-3 py-1.5", active ? "bg-paper font-medium text-ink" : "text-muted hover:bg-paper/60 hover:text-ink")}>
                <Icon className="h-4 w-4" aria-hidden />
                <span className="flex-1">{label}</span>
                {path === "/issues" && openIssues > 0 && <span className="rounded bg-burgundy px-1.5 text-[11px] font-medium text-ivory">{openIssues}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mb-6">
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Coming soon</p>
        {["Publishing", "Marketing"].map((l) => (
          <p key={l} className="px-3 py-1.5 text-muted/60">
            {l}
          </p>
        ))}
      </div>
      <Link href={`${base}/settings`} className={clsx("flex items-center gap-2.5 rounded-md px-3 py-1.5", pathname.startsWith(`${base}/settings`) ? "bg-paper font-medium" : "text-muted hover:bg-paper/60")}>
        <Settings className="h-4 w-4" aria-hidden /> Book settings
      </Link>
    </nav>
  );
}
