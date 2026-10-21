import type { Metadata } from "next";
import { AugmentCard } from "@/components/content/cards";
import { PageIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Augmentasyonlar") };
}

export default async function AugmentsPage() {
  const tt = await getT();
  const augs = content(await getLocale()).augments;
  const tiers = ["T1", "T2", "T3"] as const;
  return (
    <div>
      <PageHeader
        kicker={tt("Örnekler")}
        title={
          <span className="flex items-center gap-3">
            <PageIcon page="augmentler" />
            {tt("Augmentasyonlar")}
          </span>
        }
      >
        {tt(
          "Augment kullanma becerisi Klang ile ölçülür; her uzuv slotuna 1 augment takılabilir. T1 augmentler hafif ve yaygın, T3 augmentler güçlü ama ağır bedellidir. Stat etkileri karakter kağıdında otomatik hesaplanır.",
        )}
      </PageHeader>
      {tiers.map((t) => (
        <section key={t} className="mb-10">
          <h2 className="mb-4 text-xl">{t}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {augs
              .filter((a) => a.tier === t)
              .map((a) => (
                <AugmentCard key={a.key} augment={a} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
