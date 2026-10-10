import { MoonLogo } from "./logo";
import { UcMobileMenu } from "./nav-client";

const LINKS = [
  { href: "/umbracaelis/kurallar", label: "Kurallar" },
  { href: "/umbracaelis/kurallar/siniflar", label: "Sınıflar" },
  { href: "/umbracaelis/kurallar/perkler", label: "Perkler" },
  { href: "/umbracaelis/kurallar/sozluk", label: "Sözlük" },
];

/** Umbra Caelis üst çubuğu. Bu bölümde hesap yoktur; bağlantılar düz <a> (adres /umbracaelis altında kalır). */
export function UcTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="/umbracaelis/kurallar" className="flex items-center gap-2.5">
          <MoonLogo className="h-8 w-8 text-accent" />
          <span className="leading-tight">
            <span className="block font-serif text-[15px] font-semibold tracking-[0.12em] text-ink">UMBRA CAELIS</span>
            <span className="block text-[10px] uppercase tracking-[0.22em] text-lav">TTRPG · Kurallar</span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-ink">
              {l.label}
            </a>
          ))}
          <span className="mx-2 h-5 w-px bg-line" />
          <a href="/" className="rounded-md px-3 py-2 text-sm text-muted transition hover:bg-surface2 hover:text-ink">
            umbracaelis.com
          </a>
        </nav>
        <UcMobileMenu links={[...LINKS, { href: "/", label: "umbracaelis.com" }]} />
      </div>
    </header>
  );
}
