import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";
import { tipText } from "@/lib/shz/tips";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Arama") };
}

function snippet(text: string, q: string) {
  const i = text.indexOf(q);
  if (i < 0) return text.slice(0, 160);
  const s = Math.max(0, i - 60);
  return (s ? "…" : "") + text.slice(s, i + 100) + "…";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const t = await getT();
  const loc = await getLocale();
  const q = (raw ?? "").trim().toLocaleLowerCase(loc === "en" ? "en-GB" : "tr-TR").slice(0, 60);
  const c = content(loc);
  const tip = (kind: "abilities" | "perks" | "augments", key: string) => tipText(kind, key, loc);
  const hits: { href: string; title: string; kind: string; text: string }[] = [];
  if (q.length >= 2) {
    for (const d of c.docs) if (d.searchText.includes(q)) hits.push({ href: `/kurallar/${d.key}`, title: d.title, kind: t("Kural"), text: snippet(d.searchText, q) });
    for (const a of Object.values(c.abilities))
      if (a.searchText.includes(q) || tip("abilities", a.key).includes(q))
        hits.push({ href: `/kurallar/yetenekler/${a.tree}#${a.key}`, title: a.name, kind: t("Yetenek"), text: snippet(a.searchText.includes(q) ? a.searchText : tip("abilities", a.key), q) });
    for (const p of c.perks)
      if (p.searchText.includes(q) || tip("perks", p.key).includes(q))
        hits.push({ href: `/kurallar/perkler#${p.key}`, title: p.name, kind: "Perk", text: snippet(p.searchText.includes(q) ? p.searchText : tip("perks", p.key), q) });
    for (const a of c.augments)
      if (a.searchText.includes(q) || tip("augments", a.key).includes(q))
        hits.push({ href: `/kurallar/augmentler#${a.key}`, title: a.name, kind: "Augment", text: snippet(a.searchText.includes(q) ? a.searchText : tip("augments", a.key), q) });
  }
  return (
    <div className="max-w-3xl">
      <PageHeader kicker={t("Arama")} title={raw ? `“${raw.slice(0, 60)}”` : t("Arama")}>
        {q.length >= 2 ? t("{n} sonuç", { n: hits.length }) : t("En az 2 harf yaz.")}
      </PageHeader>
      {q.length >= 2 && hits.length === 0 && <Empty title={t("Sonuç yok")} />}
      <ul className="space-y-2">
        {hits.slice(0, 60).map((h) => (
          <li key={h.href}>
            <Link href={h.href} className="card block p-4 transition hover:border-accent/40">
              <p className="text-[11px] uppercase tracking-widest text-accent">{h.kind}</p>
              <p className="font-serif text-lg text-ink">{h.title}</p>
              <p className="mt-1 text-sm text-muted">{h.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
