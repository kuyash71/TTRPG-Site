"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { UcPageGlyph } from "./icons";

export function UcMobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="md:hidden">
      <button type="button" aria-label="Menü" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md border border-line px-3 py-1.5 text-sm text-ink">
        {open ? "Kapat" : "Menü"}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-line bg-bg px-4 pb-4 pt-2 shadow-card">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="block rounded-md px-3 py-2.5 text-ink hover:bg-surface2">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export interface UcNavGroup {
  title: string;
  items: { href: string; label: string; icon?: string; sub?: boolean; tier?: number; parent?: string }[];
}

/** Kural kitabının sol menüsü (SHZ kurallarıyla aynı düzen). */
export function UcRulesNav({ groups }: { groups: UcNavGroup[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const here = path.replace(/^\/schwarzesonne/, "").replace(/\/+$/, "");
  return (
    <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
      <form action="/umbracaelis/kurallar/ara" method="get" role="search">
        <input name="q" placeholder="Kurallarda ara…" className="input" maxLength={60} aria-label="Kurallarda ara" />
      </form>
      <button type="button" className="mt-3 w-full rounded-md border border-line px-3 py-2 text-left text-sm text-muted lg:hidden" onClick={() => setOpen(!open)}>
        {open ? "İçindekileri gizle" : "İçindekiler"}
      </button>
      <nav className={cx("mt-4 space-y-5 lg:block", open ? "block" : "hidden")}>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted">{g.title}</p>
            <ul>
              {g.items.map((i) => {
                // Dallar yalnızca bulunulan sınıfın altında açılır.
                if (i.parent && !(here === i.parent || here.startsWith(i.parent + "/"))) return null;
                const active = here === i.href;
                return (
                  <li key={i.href}>
                    <a
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                        i.sub && "pl-8 text-[13px]",
                        active ? "bg-accent/15 text-ink" : "text-muted hover:bg-surface2 hover:text-ink",
                      )}
                    >
                      {!i.sub && <span className="grid h-5 w-5 place-items-center text-accent">{i.icon && <UcPageGlyph page={i.icon} className="h-4 w-4" />}</span>}
                      {i.sub && <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", i.tier === 3 ? "bg-accent" : i.tier === 2 ? "bg-lav" : "bg-muted/60")} aria-hidden />}
                      {i.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
