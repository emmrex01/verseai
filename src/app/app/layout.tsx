import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Workspace", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { user } = await requireUser();
  const isAdmin = Boolean(user.email && env.adminEmails().includes(user.email.toLowerCase()));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ivory/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo href="/app" size="sm" />
            <nav className="hidden items-center gap-5 text-sm text-muted sm:flex" aria-label="Workspace">
              <Link href="/app" className="hover:text-ink">
                My books
              </Link>
              <Link href="/app/billing" className="hover:text-ink">
                Plan &amp; usage
              </Link>
              <Link href="/app/settings" className="hover:text-ink">
                Settings
              </Link>
              {isAdmin && (
                <Link href="/app/admin" className="hover:text-ink">
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
