import { KeyRound, MoonStar } from "lucide-react";
import Link from "next/link";
import { SunLogo } from "./logo";
import type { SessionUser } from "@/lib/auth/session";
import { LogoutButton, MobileMenu } from "./nav-client";

export function Brand() {
  return (
    <Link href="/panel" className="flex items-center gap-2.5">
      <SunLogo className="h-8 w-8 text-accent" />
      <span className="leading-tight">
        <span className="block font-serif text-[15px] font-semibold tracking-[0.06em] text-ink">SCHWARZESONNE</span>
        <span lang="en" className="block text-[10px] uppercase tracking-[0.22em] text-accent">Umbra Caelis</span>
      </span>
    </Link>
  );
}

export function TopNav({ user, resets = 0 }: { user: SessionUser | null; resets?: number }) {
  const links = user
    ? [
        { href: "/panel", label: "Panel" },
        { href: "/kurallar", label: "Kurallar" },
        { href: "/yardim", label: "Yardım" },
        ...(user.role === "GM" ? [{ href: "/yonetim", label: "Yönetim" }] : []),
        { href: "/hesap", label: "Hesap" },
      ]
    : [
        { href: "/kurallar", label: "Kurallar" },
        { href: "/yardim", label: "Yardım" },
        { href: "/giris", label: "Giriş" },
      ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-ink">
              {l.label}
            </Link>
          ))}
          {user && (
            <>
              {/* Sistem geçişi: aynı hesapla Umbra Caelis paneline (düz bağlantı: /umbracaelis uygulama alt yolunun dışında). */}
              <a
                href="/umbracaelis/panel"
                className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                title="Umbra Caelis paneline geç"
              >
                <MoonStar className="h-3.5 w-3.5" /> Umbra Caelis
              </a>
              {resets > 0 && (
                <Link
                  href="/panel#sifre-istekleri"
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-warn/50 bg-warn/10 px-2 py-1.5 text-xs text-warn"
                  title="Şifre sıfırlama istekleri"
                >
                  <KeyRound className="h-3.5 w-3.5" /> {resets}
                </Link>
              )}
              <span className="mx-2 h-5 w-px bg-line" />
              <span className="mr-1 text-sm text-ink/80">
                {user.displayName}
                {user.role === "GM" && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">GM</span>}
              </span>
              <LogoutButton />
            </>
          )}
        </nav>
        <MobileMenu
          links={user ? [...links, ...(resets > 0 ? [{ href: "/panel#sifre-istekleri", label: `Şifre istekleri (${resets})` }] : [])] : links}
          extra={user ? [{ href: "/umbracaelis/panel", label: "Umbra Caelis'e geç" }] : []}
          loggedIn={!!user}
          name={user?.displayName ?? null}
        />
      </div>
    </header>
  );
}
