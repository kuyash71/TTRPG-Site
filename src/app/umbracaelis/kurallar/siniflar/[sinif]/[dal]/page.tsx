import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatBadge, TIER_LABEL, UcAbilityCard, UcHtml, UcMeaning, UcTipButton } from "@/components/uc/cards";
import { UcDalIcon } from "@/components/uc/icons";
import { Badge, PageHeader } from "@/components/ui";
import { UC_BASE, UC_TIER_OPEN } from "@/lib/uc/constants";
import { ucClass, ucContent, ucDal } from "@/lib/uc/content";
import { splitLead } from "@/lib/uc/html";

export async function generateMetadata({ params }: { params: Promise<{ sinif: string; dal: string }> }): Promise<Metadata> {
  const { sinif, dal } = await params;
  const d = ucDal(dal);
  const cl = ucClass(sinif);
  return { title: d && cl ? `${d.name} · ${cl.name}` : "Sınıflar" };
}

export default async function UcDalPage({ params }: { params: Promise<{ sinif: string; dal: string }> }) {
  const { sinif, dal } = await params;
  const cl = ucClass(sinif);
  const d = ucDal(dal);
  if (!cl || !d || d.classKey !== cl.key) notFound();
  const c = ucContent();
  const sibling = cl.dals.map((k) => c.dals[k]).find((x) => x.tier === d.tier && x.key !== d.key);
  const idx = cl.dals.indexOf(d.key);
  const prev = idx > 0 ? c.dals[cl.dals[idx - 1]] : null;
  const next = idx < cl.dals.length - 1 ? c.dals[cl.dals[idx + 1]] : null;
  const lock = UC_TIER_OPEN[d.tier] + 2;
  const [lead, rest] = splitLead(d.introHtml);
  const restHeads = [...rest.matchAll(/<h[234][^>]*>(.*?)<\/h[234]>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        <a href={`${UC_BASE}/siniflar`} className="hover:text-ink">
          Sınıflar
        </a>{" "}
        /{" "}
        <a href={`${UC_BASE}/siniflar/${cl.key}`} className="hover:text-ink">
          {cl.name}
        </a>
      </p>
      <PageHeader
        kicker={`${cl.name} · ${TIER_LABEL[d.tier]}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <UcDalIcon dalKey={d.key} tier={d.tier} className="h-12 w-12" />
            {d.name}
            <UcTipButton kind="dals" id={d.key} title={d.name} />
          </span>
        }
        actions={<StatBadge stat={d.stat} />}
      >
        <UcMeaning kind="dals" id={d.key} className="mb-2 block text-sm" />
        <UcHtml html={lead} />
        {d.startBonusText && (
          <p className="mt-3 rounded-lg border border-accent/35 bg-accent/[0.07] px-3 py-2 text-sm text-ink/90">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-accent">Başlangıç bonusu</span> {d.startBonusText}
          </p>
        )}
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Badge>Seviye {UC_TIER_OPEN[d.tier]}&apos;da açılır</Badge>
        <Badge>Açmak 1 puan · her seviye 1 puan</Badge>
        <Badge>3. seviye en erken Sv {lock}</Badge>
        {sibling && (
          <a href={`${UC_BASE}/siniflar/${cl.key}/${sibling.key}`} className="inline-flex items-center gap-1 rounded-full border border-lav/40 bg-lav/10 px-2 py-0.5 text-[11px] font-medium text-lav hover:bg-lav/20">
            Bu katmandaki diğer dal: {sibling.name} →
          </a>
        )}
      </div>
      {rest && (
        <details className="card group mb-6 p-0" open={restHeads.length <= 1}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-lav">Dalın ek kuralları</span>
              <span className="font-serif text-base text-ink">{restHeads.join(" · ") || "Ayrıntılar"}</span>
            </span>
            <span className="text-sm text-muted group-open:hidden">Göster</span>
            <span className="hidden text-sm text-muted group-open:inline">Gizle</span>
          </summary>
          <div className="border-t border-line px-5 py-4">
            <UcHtml html={rest} />
          </div>
        </details>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {d.abilities.map((k) => (
          <UcAbilityCard key={k} ability={c.abilities[k]} />
        ))}
      </div>
      <nav className="mt-10 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-sm">
        {prev ? (
          <a href={`${UC_BASE}/siniflar/${cl.key}/${prev.key}`} className="text-muted hover:text-ink">
            ← K{prev.tier} · {prev.name}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a href={`${UC_BASE}/siniflar/${cl.key}/${next.key}`} className="text-muted hover:text-ink">
            K{next.tier} · {next.name} →
          </a>
        )}
      </nav>
    </div>
  );
}
