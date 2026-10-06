import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-ivory hover:bg-ink/85",
  accent: "bg-burgundy text-ivory hover:bg-burgundy-dark",
  secondary: "border border-line bg-white text-ink hover:bg-paper",
  ghost: "text-ink hover:bg-paper",
};
const sizes = { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-6 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", className?: string) {
  return clsx(buttonBase, variants[variant], sizes[size], className);
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-lg border border-line bg-white", className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-xs font-semibold uppercase tracking-[0.18em] text-gold", className)}>{children}</p>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export type Severity = "critical" | "high" | "medium" | "low";

const severityStyles: Record<Severity, string> = {
  critical: "bg-critical-soft text-critical",
  high: "bg-amber-soft text-amber",
  medium: "bg-gold-soft text-[#7d5f2c]",
  low: "bg-paper text-muted",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={clsx("inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize", severityStyles[severity])}>{severity}</span>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex rounded bg-paper px-2 py-0.5 text-xs font-medium text-muted", className)}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={clsx("h-full rounded-full", pct > 90 ? "bg-burgundy" : "bg-gold")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
