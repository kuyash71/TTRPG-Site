import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UcDalCard, UcHtml, UcMeaning, UcTipButton } from "@/components/uc/cards";
import { UcClassIcon } from "@/components/uc/icons";
import { PageHeader, cx } from "@/components/ui";
import { UC_BASE, UC_TIER_OPEN } from "@/lib/uc/constants";
import { ucClass, ucContent } from "@/lib/uc/content";
import { splitLead } from "@/lib/uc/html";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ sinif: string }> }): Promise<Metadata> {
  const { sinif } = await params;
  const t = await getT();
  return { title: ucClass(sinif, await getLocale())?.name ?? t("Sınıflar") };
}

export default async function UcClassPage({ params }: { params: Promise<{ sinif: string }> }) {
  const { sinif } = await params;
  const tt = await getT();
  const loc = await getLocale();
  const cl = ucClass(sinif, loc);
  if (!cl) notFound();
  const c = ucContent(loc);
  const [lead, rest] = splitLead(cl.introHtml);
  return (
    <div>
      <PageHeader
        kicker={tt("Ana sınıf")}
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
          {loc === "en" ? (
            <>
              Click the <span className="text-lav">light bulb</span> icon next to foreign names to see what the name means and what it does.
            </>
          ) : (
            <>
              Yabancı adların yanındaki <span className="text-lav">ampul</span> simgesine tıklayınca adın Türkçe anlamını ve ne işe yaradığını görürsün.
            </>
          )}
        </p>
      </PageHeader>
      <div className="space-y-8">
        {([1, 2, 3] as const).map((t) => (
          <section key={t}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl text-ink">{tt("Katman {n}", { n: t })}</h2>
              <span className="text-sm text-muted">
                {tt("Seviye {n}'da açılır · iki daldan birini seçersin · her dalda 6 yetenek (2 Vertex) · bu katmanda 5 yetenek puanı", { n: UC_TIER_OPEN[t] })}
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
      {cl.faiths && cl.faiths.length > 0 && (
        <section id="inanc" className="mt-10 scroll-mt-24 border-t border-line pt-6">
          <h2 className="mb-2 font-serif text-2xl text-ink">{tt("İnanç")}</h2>
          {cl.faithIntroHtml && <UcHtml html={cl.faithIntroHtml} className="mb-4 max-w-3xl text-ink/85" />}
          <div className="grid gap-3 md:grid-cols-2">
            {cl.faiths.map((f) => (
              <article key={f.key} id={`inanc-${f.key}`} className={cx("card scroll-mt-24 p-5", f.esoteric && "border-lav/45")}>
                <h3 className="font-serif text-xl text-ink">{f.name}</h3>
                {f.esoteric && <p className="text-[11px] font-semibold uppercase tracking-widest text-lav">{tt("Gizli inanç · oyuna +{n} Yozlaşma ile başlanır", { n: f.startCorruption })}</p>}
                {f.html && <UcHtml html={f.html} className="mt-2 text-sm" />}
                {f.options.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {f.options.map((o) => (
                      <li key={o.key} className="rounded-lg border border-line bg-surface2/50 px-3 py-2 text-sm">
                        <span className="font-semibold text-ink">{o.name}</span>
                        {o.html && <UcHtml html={o.html} className="mt-0.5 text-ink/85" />}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {rest && (
        <section className="mt-10 max-w-3xl border-t border-line pt-6">
          <UcHtml html={rest} />
        </section>
      )}
    </div>
  );
}
