import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { StatusText } from "./status-text";

export function cx(...c: (string | false | null | undefined | 0)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-onAccent hover:bg-accent/90 font-semibold",
  secondary: "bg-surface2 text-ink hover:bg-line border border-line",
  outline: "border border-accent/50 text-accent hover:bg-accent/10",
  ghost: "text-muted hover:text-ink hover:bg-surface2",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};
export function btnClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex select-none items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...p} className={btnClass(variant, size, className)} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  // /umbracaelis adresleri uygulama alt yolunun dışındadır: düz bağlantı.
  if (href.startsWith("/umbracaelis"))
    return (
      <a href={href} className={btnClass(variant, size, className)}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={btnClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" }) {
  return <As className={cx("card", className)}>{children}</As>;
}

export function PageHeader({ kicker, title, children, actions }: { kicker?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="text-3xl text-ink sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "border-line bg-surface2 text-ink/80",
  accent: "border-accent/40 bg-accent/10 text-accent",
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  danger: "border-danger/40 bg-danger/10 text-danger",
};
export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-lg text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, error, lang }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null; lang?: string }) {
  return (
    <label className="block">
      <span className="label" lang={lang}>
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Onay bekliyor", tone: "warn" },
  ACTIVE: { label: "Aktif", tone: "ok" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  DEAD: { label: "Öldü", tone: "danger" },
  RETIRED: { label: "Emekli", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={s.tone}>
      <StatusText label={s.label} />
    </Badge>
  );
}
