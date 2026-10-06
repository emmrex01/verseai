import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl()),
  title: {
    default: "Verse — Your book. Understood.",
    template: "%s · Verse",
  },
  description:
    "Verse is the AI editorial workspace that understands your entire manuscript — catch story inconsistencies, track every character, map your timeline, and ask your book anything, with evidence.",
  applicationName: "Verse",
  openGraph: { type: "website", siteName: "Verse", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#faf8f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} h-full`}>
      <body className="min-h-full bg-ivory text-ink">{children}</body>
    </html>
  );
}
