import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui";
import { UC_BASE } from "@/lib/uc/constants";
import { ucAbilityHref, ucContent } from "@/lib/uc/content";
import { ucTipText, type UcTipKind } from "@/lib/uc/tips";
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

export default async function UcSearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const t = await getT();
  const loc = await getLocale();
  const q = raw.trim().toLocaleLowerCase(loc === "en" ? "en-GB" : "tr-TR").slice(0, 60);
  const c = ucContent(loc);
  const tip = (kind: UcTipKind, key: string) => ucTipText(kind, key, loc);
  const hits: { href: string; title: string; kind: string; text: string }[] = [];
  const pick = (a: string, b: string) => (a.includes(q) ? a : b);
  if (q.length >= 2) {
    for (const d of c.docs) if (d.searchText.includes(q)) hits.push({ href: `${UC_BASE}/${d.key}`, title: d.title, kind: t("Kural"), text: snippet(d.searchText, q) });
    for (const cl of c.classes)
      if (cl.searchText.includes(q) || tip("classes", cl.key).includes(q))
        hits.push({ href: `${UC_BASE}/siniflar/${cl.key}`, title: cl.name, kind: t("Sınıf"), text: snippet(pick(cl.searchText, tip("classes", cl.key)), q) });
    for (const d of Object.values(c.dals))
      if (d.searchText.includes(q) || tip("dals", d.key).includes(q))
        hits.push({ href: `${UC_BASE}/siniflar/${d.classKey}/${d.key}`, title: d.name, kind: t("Dal · K{n}", { n: d.tier }), text: snippet(pick(d.searchText, tip("dals", d.key)), q) });
    for (const a of Object.values(c.abilities))
      if (a.searchText.includes(q) || tip("abilities", a.key).includes(q))
        hits.push({ href: ucAbilityHref(a), title: a.name, kind: t("Yetenek"), text: snippet(pick(a.searchText, tip("abilities", a.key)), q) });
    for (const p of c.perks)
      if (p.searchText.includes(q) || tip("perks", p.key).includes(q))
        hits.push({ href: `${UC_BASE}/perkler#${p.key}`, title: p.name, kind: "Perk", text: snippet(pick(p.searchText, tip("perks", p.key)), q) });
  }
  return (
    <div className="max-w-3xl">
      <PageHeader kicker={t("Arama")} title={raw ? `“${raw.slice(0, 60)}”` : t("Arama")}>
        {q.length >= 2 ? t("{n} sonuç", { n: hits.length }) : t("En az 2 harf yaz.")}
      </PageHeader>
      <form action={`${UC_BASE}/ara`} method="get" role="search" className="mb-6 flex gap-2">
        <input name="q" defaultValue={raw.slice(0, 60)} className="input" maxLength={60} placeholder={t("Kurallarda ara…")} aria-label={t("Kurallarda ara")} />
        <button type="submit" className="rounded-lg bg-accent px-4 text-sm font-semibold text-onAccent hover:bg-accent/90">
          {t("Ara")}
        </button>
      </form>
      {q.length >= 2 && hits.length === 0 && <Empty title={t("Sonuç yok")} />}
      <ul className="space-y-2">
        {hits.slice(0, 60).map((h) => (
          <li key={h.href + h.kind}>
            <a href={h.href} className="card block p-4 transition hover:border-accent/45">
              <p className="text-[11px] uppercase tracking-widest text-lav">{h.kind}</p>
              <p className="font-serif text-lg text-ink">{h.title}</p>
              <p className="mt-1 text-sm text-muted">{h.text}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
