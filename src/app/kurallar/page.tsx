import type { Metadata } from "next";
import Link from "next/link";
import { PageIcon, TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { Badge, PageHeader } from "@/components/ui";
import { STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";

export const metadata: Metadata = { title: "Kurallar" };

export default function RulesIndex() {
  const c = content();
  const cards = [
    ...c.docs.map((d) => ({ href: `/kurallar/${d.key}`, icon: d.key, title: d.title, text: "Temel kural metni" })),
    { href: "/kurallar/sozluk", icon: "sozluk", title: "Sözlük", text: "Almanca terimlerin Türkçe anlamları ve okunuşları" },
    { href: "/kurallar/perkler", icon: "perkler", title: "Perkler", text: `${c.perks.filter((p) => p.kind === "positive").length} pozitif · ${c.perks.filter((p) => p.kind === "negative").length} negatif` },
    { href: "/kurallar/augmentler", icon: "augmentler", title: "Augmentasyonlar", text: `${c.augments.length} örnek augment` },
    { href: "/kurallar/kampanyalar", icon: "kampanyalar", title: "Kampanyalar", text: `${c.campaigns.length} kampanya` },
  ];
  return (
    <div>
      <PageHeader kicker="SHZ-TTRPG" title="Oyuncu Kural Kitabı">
        Temel mekanikler, karakter yaratma, perkler, ekspertiz ağaçları ve augmentasyonlar. İçerik doğrudan GM&apos;in kural dosyalarından üretilir.
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
      <h2 className="mb-3 mt-10 text-xl">Ekspertiz ağaçları</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {c.trees.map((t) => (
          <Link key={t.key} href={`/kurallar/yetenekler/${t.key}`} className="card p-4 transition hover:border-accent/40">
            <div className="flex items-center gap-3">
              <TreeIcon treeKey={t.key} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-serif text-base">
                  <span className="min-w-0 break-all">{t.name}</span>
                  <TipButton kind="trees" id={t.key} title={t.name} />
                </span>
                <span className="flex items-center gap-2">
                  <Meaning kind="trees" id={t.key} />
                  <Badge tone="accent">{STAT_LABELS[t.stat]}</Badge>
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">{t.startBonusText}</p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-xs text-muted">Sürüm {c.hash} · {new Date(c.generatedAt).toLocaleDateString("tr-TR")}</p>
    </div>
  );
}
