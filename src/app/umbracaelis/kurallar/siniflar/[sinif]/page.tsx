import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UcDalCard, UcHtml, UcMeaning, UcTipButton } from "@/components/uc/cards";
import { UcClassIcon } from "@/components/uc/icons";
import { PageHeader } from "@/components/ui";
import { UC_BASE, UC_TIER_OPEN } from "@/lib/uc/constants";
import { ucClass, ucContent } from "@/lib/uc/content";
import { splitLead } from "@/lib/uc/html";

export async function generateMetadata({ params }: { params: Promise<{ sinif: string }> }): Promise<Metadata> {
  const { sinif } = await params;
  return { title: ucClass(sinif)?.name ?? "Sınıflar" };
}

export default async function UcClassPage({ params }: { params: Promise<{ sinif: string }> }) {
  const { sinif } = await params;
  const cl = ucClass(sinif);
  if (!cl) notFound();
  const c = ucContent();
  const [lead, rest] = splitLead(cl.introHtml);
  return (
    <div>
      <PageHeader
        kicker="Ana sınıf"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <UcClassIcon classKey={cl.key} />
            {cl.name}
            <UcTipButton kind="classes" id={cl.key} title={cl.name} />
          </span>
        }
      >
        <UcMeaning kind="classes" id={cl.key} className="mb-2 block text-sm" />
        <UcHtml html={lead} />
        <p className="mt-2 text-sm">
          Yabancı adların yanındaki <span className="text-lav">ampul</span> simgesine tıklayınca adın Türkçe anlamını ve ne işe yaradığını görürsün.
        </p>
      </PageHeader>
      <div className="space-y-8">
        {([1, 2, 3] as const).map((t) => (
          <section key={t}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl text-ink">Katman {t}</h2>
              <span className="text-sm text-muted">
                Seviye {UC_TIER_OPEN[t]}&apos;da açılır · iki daldan birini seçersin · bu katmanda 5 yetenek puanı
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {cl.dals
                .map((k) => c.dals[k])
                .filter((d) => d.tier === t)
                .map((d) => (
                  <UcDalCard
                    key={d.key}
                    dal={d}
                    href={`${UC_BASE}/siniflar/${cl.key}/${d.key}`}
                    abilityNames={d.abilities.map((k) => ({ key: k, name: c.abilities[k].name, signature: c.abilities[k].signature }))}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
      {rest && (
        <section className="mt-10 max-w-3xl border-t border-line pt-6">
          <UcHtml html={rest} />
        </section>
      )}
    </div>
  );
}
