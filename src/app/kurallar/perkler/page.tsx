import type { Metadata } from "next";
import { PerkCard } from "@/components/content/cards";
import { PageIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Perkler") };
}

export default async function PerksPage() {
  const t = await getT();
  const loc = await getLocale();
  const perks = content(loc).perks;
  const name = new Map(perks.map((p) => [p.key, p.name]));
  return (
    <div>
      <PageHeader
        kicker={t("Karakter yaratma")}
        title={
          <span className="flex items-center gap-3">
            <PageIcon page="perkler" />
            {t("Perkler")}
          </span>
        }
      >
        {loc === "en" ? (
          <>
            Positive perks <strong className="text-ink">cost</strong> perk points, negative perks <strong className="text-ink">grant</strong> perk points. You can take as many perks as you
            like as long as your total doesn&apos;t drop below zero; leftover points convert to stat points as (Points + 1) / 2 (rounded down).
          </>
        ) : (
          <>
            Pozitif perkler perk puanı <strong className="text-ink">harcar</strong>, negatif perkler perk puanı <strong className="text-ink">kazandırır</strong>. Toplam puan negatife düşmeden
            istediğin kadar perk alabilirsin; artan puan (Puan + 1) / 2 (aşağı yuvarla) olarak stat puanına dönüşür.
          </>
        )}
      </PageHeader>
      {(["positive", "negative"] as const).map((k) => (
        <section key={k} className="mb-10">
          <h2 className="mb-4 text-xl">{k === "positive" ? t("Pozitif perkler") : t("Negatif perkler")}</h2>
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
