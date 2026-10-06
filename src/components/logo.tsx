import Link from "next/link";
import { clsx } from "clsx";

export function VerseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <path d="M22 31.2 L62 7.2 V19.2 L22 43.2 Z" fill="#B28A4A" />
      <path d="M2 34 L30 17.2 V29.2 L2 46 Z" fill="#171717" />
    </svg>
  );
}

export function Logo({ href = "/", className, size = "md" }: { href?: string; className?: string; size?: "sm" | "md" }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2.5", className)} aria-label="Verse home">
      <VerseMark className={size === "sm" ? "h-5 w-auto" : "h-6 w-auto"} />
      <span className={clsx("font-serif font-semibold tracking-[0.22em] text-ink", size === "sm" ? "text-base" : "text-lg")}>VERSE</span>
    </Link>
  );
}
