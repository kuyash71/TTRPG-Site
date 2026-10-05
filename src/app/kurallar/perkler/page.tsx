import type { Metadata } from "next";
import { PerkCard } from "@/components/content/cards";
import { PageIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";

export const metadata: Metadata = { title: "Perkler" };

export default function PerksPage() {
  const perks = content().perks;
  const name = new Map(perks.map((p) => [p.key, p.name]));
  return (
    <div>
      <PageHeader
        kicker="Karakter yaratma"
        title={
          <span className="flex items-center gap-3">
            <PageIcon page="perkler" />
            Perkler
          </span>
        }
      >
        Pozitif perkler perk puanı <strong className="text-ink">harcar</strong>, negatif perkler perk puanı <strong className="text-ink">kazandırır</strong>. Toplam puan negatife düşmeden
        istediğin kadar perk alabilirsin; artan puan (Puan + 1) / 2 (aşağı yuvarla) olarak stat puanına dönüşür.
      </PageHeader>
      {(["positive", "negative"] as const).map((k) => (
        <section key={k} className="mb-10">
          <h2 className="mb-4 text-xl">{k === "positive" ? "Pozitif perkler" : "Negatif perkler"}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {perks
              .filter((p) => p.kind === k)
              .map((p) => (
                <PerkCard key={p.key} perk={p} exclusiveNames={p.exclusive.map((x) => name.get(x) ?? x)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
