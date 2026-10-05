import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";
import { tipText } from "@/lib/shz/tips";

export const metadata: Metadata = { title: "Arama" };

function snippet(text: string, q: string) {
  const i = text.indexOf(q);
  if (i < 0) return text.slice(0, 160);
  const s = Math.max(0, i - 60);
  return (s ? "…" : "") + text.slice(s, i + 100) + "…";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().toLocaleLowerCase("tr-TR").slice(0, 60);
  const c = content();
  const hits: { href: string; title: string; kind: string; text: string }[] = [];
  if (q.length >= 2) {
    for (const d of c.docs) if (d.searchText.includes(q)) hits.push({ href: `/kurallar/${d.key}`, title: d.title, kind: "Kural", text: snippet(d.searchText, q) });
    for (const a of Object.values(c.abilities))
      if (a.searchText.includes(q) || tipText("abilities", a.key).includes(q))
        hits.push({ href: `/kurallar/yetenekler/${a.tree}#${a.key}`, title: a.name, kind: "Yetenek", text: snippet(a.searchText.includes(q) ? a.searchText : tipText("abilities", a.key), q) });
    for (const p of c.perks)
      if (p.searchText.includes(q) || tipText("perks", p.key).includes(q))
        hits.push({ href: `/kurallar/perkler#${p.key}`, title: p.name, kind: "Perk", text: snippet(p.searchText.includes(q) ? p.searchText : tipText("perks", p.key), q) });
    for (const a of c.augments)
      if (a.searchText.includes(q) || tipText("augments", a.key).includes(q))
        hits.push({ href: `/kurallar/augmentler#${a.key}`, title: a.name, kind: "Augment", text: snippet(a.searchText.includes(q) ? a.searchText : tipText("augments", a.key), q) });
  }
  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Arama" title={raw ? `“${raw.slice(0, 60)}”` : "Arama"}>
        {q.length >= 2 ? `${hits.length} sonuç` : "En az 2 harf yaz."}
      </PageHeader>
      {q.length >= 2 && hits.length === 0 && <Empty title="Sonuç yok" />}
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
