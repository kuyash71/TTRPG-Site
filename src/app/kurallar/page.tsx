import type { Metadata } from "next";
import Link from "next/link";
import { PageIcon, TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { Badge, PageHeader } from "@/components/ui";
import { STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";
import { intlLocale } from "@/i18n/core";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Kurallar") };
}

export default async function RulesIndex() {
  const t = await getT();
  const loc = await getLocale();
  const c = content(loc);
  const cards = [
    ...c.docs.map((d) => ({ href: `/kurallar/${d.key}`, icon: d.key, title: d.title, text: t("Temel kural metni") })),
    { href: "/kurallar/sozluk", icon: "sozluk", title: t("Sözlük"), text: t("Almanca terimlerin Türkçe anlamları ve okunuşları") },
    { href: "/kurallar/perkler", icon: "perkler", title: t("Perkler"), text: t("{pos} pozitif · {neg} negatif", { pos: c.perks.filter((p) => p.kind === "positive").length, neg: c.perks.filter((p) => p.kind === "negative").length }) },
    { href: "/kurallar/augmentler", icon: "augmentler", title: t("Augmentasyonlar"), text: t("{n} örnek augment", { n: c.augments.length }) },
    { href: "/kurallar/kampanyalar", icon: "kampanyalar", title: t("Kampanyalar"), text: t("{n} kampanya", { n: c.campaigns.length }) },
  ];
  return (
    <div>
      <PageHeader kicker="SHZ-TTRPG" title={t("Oyuncu Kural Kitabı")}>
        {t("Temel mekanikler, karakter yaratma, perkler, ekspertiz ağaçları ve augmentasyonlar. İçerik doğrudan GM'in kural dosyalarından üretilir.")}
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((x) => (
          <Link key={x.href} href={x.href} className="card flex items-start gap-4 p-5 transition hover:border-accent/40">
            <PageIcon page={x.icon} />
            <div className="min-w-0">
              <p className="font-serif text-lg text-ink">{x.title}</p>
              <p className="mt-1 text-sm text-muted">{x.text}</p>
            </div>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-xl">{t("Ekspertiz ağaçları")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {c.trees.map((tr) => (
          <Link key={tr.key} href={`/kurallar/yetenekler/${tr.key}`} className="card p-4 transition hover:border-accent/40">
            <div className="flex items-center gap-3">
              <TreeIcon treeKey={tr.key} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-serif text-base">
                  <span className="min-w-0 break-all">{tr.name}</span>
                  <TipButton kind="trees" id={tr.key} title={tr.name} />
                </span>
                <span className="flex items-center gap-2">
                  <Meaning kind="trees" id={tr.key} />
                  <Badge tone="accent">{STAT_LABELS[tr.stat]}</Badge>
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">{tr.startBonusText}</p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-xs text-muted">{t("Sürüm {v}", { v: c.hash })} · {new Date(c.generatedAt).toLocaleDateString(intlLocale(loc))}</p>
    </div>
  );
}
