"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { PageGlyph, TreeIcon } from "@/components/content/icons";
import { cx } from "@/components/ui";

export function RulesNav({ groups }: { groups: { title: string; items: { href: string; label: string; icon?: string; tree?: string }[] }[] }) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/kurallar/ara?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kurallarda ara…" className="input" maxLength={60} />
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
                const active = path === `/schwarzesonne${i.href}` || path === i.href;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      className={cx("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition", active ? "bg-accent/15 text-ink" : "text-muted hover:bg-surface2 hover:text-ink")}
                    >
                      {i.tree ? (
                        <TreeIcon treeKey={i.tree} className="h-5 w-5 rounded-md" />
                      ) : (
                        <span className="grid h-5 w-5 place-items-center text-accent">{i.icon && <PageGlyph page={i.icon} className="h-4 w-4" />}</span>
                      )}
                      {i.label}
                    </Link>
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
