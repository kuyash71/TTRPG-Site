import type { Metadata } from "next";
import { UcPerkCard } from "@/components/uc/cards";
import { UcPageIcon } from "@/components/uc/icons";
import { UcPerkFilter } from "@/components/uc/perk-filter";
import { PageHeader } from "@/components/ui";
import { UC_BASE } from "@/lib/uc/constants";
import { ucContent } from "@/lib/uc/content";

export const metadata: Metadata = { title: "Perkler" };

export default function UcPerksPage() {
  const { perks, perkCategories } = ucContent();
  const name = new Map(perks.map((p) => [p.key, p.name]));
  const counts = Object.fromEntries(perkCategories.map((c) => [c, perks.filter((p) => p.category === c).length]));
  return (
    <div>
      <PageHeader
        kicker="Karakter yaratma"
        title={
          <span className="flex items-center gap-3">
            <UcPageIcon page="perkler" />
            Perkler
          </span>
        }
      >
        Pozitif perkler perk puanı <strong className="text-ink">harcar</strong>, negatif perkler perk puanı <strong className="text-ink">kazandırır</strong>. Toplam puan negatife düşmeden
        istediğin kadar perk alabilirsin; artan puan (Puan + 1) / 2 (aşağı yuvarla) olarak stat puanına dönüşür. Negatif perklerden en fazla +10 puan kazanılabilir. Ayrıntılar{" "}
        <a href={`${UC_BASE}/karakter`} className="text-accent underline decoration-accent/40 underline-offset-2">
          Karakter
        </a>{" "}
        sayfasında.
      </PageHeader>
      <UcPerkFilter categories={perkCategories} counts={counts} />
      {(["positive", "negative"] as const).map((k) => (
        <section key={k} className="mb-10" data-perk-section={k}>
          <h2 className="mb-4 text-xl">{k === "positive" ? "Pozitif perkler" : "Negatif perkler"}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {perks
              .filter((p) => p.kind === k)
              .map((p) => (
                <UcPerkCard key={p.key} perk={p} exclusiveNames={p.exclusive.map((x) => name.get(x) ?? x)} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
