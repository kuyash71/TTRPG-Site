"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const t = useT();
  return (
    <button
      type="button"
      className={className ?? "rounded-md px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink"}
      onClick={async () => {
        await api("/api/auth/logout", { body: {} }).catch(() => {});
        router.replace("/giris");
        router.refresh();
      }}
    >
      {t("Çıkış")}
    </button>
  );
}

export function MobileMenu({
  links,
  extra = [],
  loggedIn,
  name,
}: {
  links: { href: string; label: string }[];
  /** Uygulama alt yolunun dışındaki bağlantılar (düz <a>). */
  extra?: { href: string; label: string }[];
  loggedIn: boolean;
  name: string | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="md:hidden">
      <button type="button" aria-label={t("Menü")} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink">
        {open ? t("Kapat") : t("Menü")}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-bg px-4 pb-4 pt-2 shadow-card">
          {name && <p className="px-3 py-2 text-sm text-muted">{name}</p>}
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-md px-3 py-2.5 text-ink hover:bg-surface2">
              {l.label}
            </Link>
          ))}
          {extra.map((l) => (
            <a key={l.href} href={l.href} className="block rounded-md px-3 py-2.5 text-ink hover:bg-surface2">
              {l.label}
            </a>
          ))}
          {loggedIn && <LogoutButton className="block w-full rounded-md px-3 py-2.5 text-left text-ink hover:bg-surface2" />}
        </div>
      )}
    </div>
  );
}
