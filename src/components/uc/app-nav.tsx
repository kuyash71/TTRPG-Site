import { KeyRound } from "lucide-react";
import { LangSwitch } from "@/components/lang-switch";
import { LogoutButton } from "@/components/nav-client";
import { getT } from "@/i18n/server";
import type { SessionUser } from "@/lib/auth/core";
import { MoonLogo } from "./logo";
import { UcMobileMenu } from "./nav-client";

/** Umbra Caelis oyun bölümünün üst çubuğu. Hesap ortaktır; Schwarzesonne'ye tek tıkla geçilir. */
export async function UcAppNav({ user, resets = 0 }: { user: SessionUser; resets?: number }) {
  const t = await getT();
  const links = [
    { href: "/umbracaelis/panel", label: t("Panel") },
    { href: "/umbracaelis/kurallar", label: t("Kurallar") },
    ...(user.role === "GM" ? [{ href: "/schwarzesonne/yonetim", label: t("Yönetim") }] : []),
    { href: "/schwarzesonne/hesap", label: t("Hesap") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="/umbracaelis/panel" className="flex items-center gap-2.5">
          <MoonLogo className="h-8 w-8 text-accent" />
          <span className="leading-tight">
            <span className="block font-serif text-[15px] font-semibold tracking-[0.12em] text-ink">UMBRA CAELIS</span>
            <span className="block text-[10px] uppercase tracking-[0.22em] text-lav">{t("Oyun masası")}</span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-ink">
              {l.label}
            </a>
          ))}
          {resets > 0 && (
            <a href="/umbracaelis/panel#sifre-istekleri" className="ml-1 inline-flex items-center gap-1 rounded-md border border-warn/50 bg-warn/10 px-2 py-1.5 text-xs text-warn" title={t("Şifre sıfırlama istekleri")}>
              <KeyRound className="h-3.5 w-3.5" /> {resets}
            </a>
          )}
          <span className="mx-2 h-5 w-px bg-line" />
          <span className="mr-1 text-sm text-ink/80">
            {user.displayName}
            {user.role === "GM" && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">GM</span>}
          </span>
          <LogoutButton />
          <LangSwitch className="ml-2" />
        </nav>
        <LangSwitch className="ml-auto md:hidden" />
        <UcMobileMenu
          name={user.displayName}
          logout
          links={[
            ...links,
            ...(resets > 0 ? [{ href: "/umbracaelis/panel#sifre-istekleri", label: t("Şifre istekleri ({n})", { n: resets }) }] : []),
          ]}
        />
      </div>
    </header>
  );
}
