import type { Metadata } from "next";
import { StatBadge, UcHtml, UcMeaning, UcTipButton } from "@/components/uc/cards";
import { UcClassIcon, UcDalIcon, UcPageIcon } from "@/components/uc/icons";
import { PageHeader } from "@/components/ui";
import { UC_BASE } from "@/lib/uc/constants";
import { ucContent } from "@/lib/uc/content";
import { splitLead } from "@/lib/uc/html";

export const metadata: Metadata = { title: "Sınıflar" };

export default function UcClassesPage() {
  const c = ucContent();
  return (
    <div>
      <PageHeader
        kicker="Sınıf sistemi"
        title={
          <span className="flex items-center gap-3">
            <UcPageIcon page="siniflar" />
            Sınıflar
          </span>
        }
      >
        Oyun başında dört ana sınıftan birini seçersin; ana sınıf oyun boyunca değişmez. Her sınıf üç katmandan oluşur, her katmanda iki dal vardır ve her katmanda yalnızca birini
        seçersin. Ayrıntılar{" "}
        <a href={`${UC_BASE}/temel-kurallar`} className="text-accent underline decoration-accent/40 underline-offset-2">
          Temel Kurallar
        </a>{" "}
        sayfasında.
      </PageHeader>
      <div className="mb-8 grid gap-2 sm:grid-cols-3">
        {[
          { t: 1, open: "Seviye 0", pts: "Sv 0–4 · 5 puan" },
          { t: 2, open: "Seviye 5", pts: "Sv 5–9 · 5 puan" },
          { t: 3, open: "Seviye 10", pts: "Sv 10–14 · 5 puan" },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-line bg-surface/70 p-4">
            <p className="font-mono text-xs font-semibold text-accent">K{x.t}</p>
            <p className="mt-1 text-sm text-ink">{x.open}&apos;da açılır</p>
            <p className="text-xs text-muted">{x.pts}</p>
          </div>
        ))}
      </div>
      <div className="space-y-5">
        {c.classes.map((cl) => {
          const [lead] = splitLead(cl.introHtml);
          return (
            <section key={cl.key} className="card p-5">
              <a href={`${UC_BASE}/siniflar/${cl.key}`} className="group flex items-center gap-3">
                <UcClassIcon classKey={cl.key} />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-2xl text-ink group-hover:text-accent">
                    {cl.name}
                    <UcTipButton kind="classes" id={cl.key} title={cl.name} />
                  </h2>
                  <UcMeaning kind="classes" id={cl.key} />
                </div>
                <span className="hidden text-sm text-accent sm:inline">Sınıfa git →</span>
              </a>
              <UcHtml html={lead} className="mt-3 text-sm text-ink/80" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <tbody>
                    {cl.dals.map((dk) => {
                      const d = c.dals[dk];
                      return (
                        <tr key={dk} className="border-t border-line/70">
                          <td className="w-12 py-2 pr-2 font-mono text-xs font-semibold text-muted">K{d.tier}</td>
                          <td className="py-2 pr-3">
                            <a href={`${UC_BASE}/siniflar/${cl.key}/${dk}`} className="flex items-center gap-2 text-ink hover:text-accent">
                              <UcDalIcon dalKey={dk} tier={d.tier} className="h-7 w-7" />
                              <span className="font-serif text-base">{d.name}</span>
                            </a>
                          </td>
                          <td className="py-2 pr-3">
                            <StatBadge stat={d.stat} />
                          </td>
                          <td className="py-2 text-ink/80">{d.identity}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
