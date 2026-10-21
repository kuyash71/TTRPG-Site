"use client";
import { Lightbulb } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import type { ReactNode } from "react";
import { Badge, cx } from "@/components/ui";
import { UC_STAT_LABELS } from "@/lib/uc/constants";
import type { UcAbility, UcDal, UcPerk } from "@/lib/uc/content-types";
import { ucEnrich } from "@/lib/uc/enrich";
import { ucTipFor, type UcTipKind } from "@/lib/uc/tips";
import { TIER_LABEL, ucBaseType } from "@/lib/uc/labels";
import { UcAbilityIcon, UcCategoryGlyph, UcDalIcon, UcPerkIcon } from "./icons";

export function UcHtml({ html, className }: { html: string; className?: string }) {
  const loc = useLocale();
  if (!html) return null;
  return <div className={cx("prose-shz", className)} dangerouslySetInnerHTML={{ __html: ucEnrich(html, loc) }} />;
}

/** Yabancı bir adın yanındaki ipucu düğmesi; davranış TipLayer'dadır (data-tip-src="uc"). */
export function UcTipButton({ kind, id, title, className }: { kind: UcTipKind; id: string; title: string; className?: string }) {
  const loc = useLocale();
  const t = useT();
  if (!ucTipFor(kind, id, loc)) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      data-tip-src="uc"
      data-tip-kind={kind}
      data-tip-key={id}
      data-tip-title={title}
      aria-label={t("{title}: ne işe yarar?", { title })}
      title={t("Ne işe yarar?")}
      className={cx(
        "inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border border-lav/45 bg-lav/10 align-middle text-lav transition hover:bg-lav/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lav",
        className,
      )}
    >
      <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

export function UcMeaning({ kind, id, className }: { kind: UcTipKind; id: string; className?: string }) {
  const loc = useLocale();
  const m = ucTipFor(kind, id, loc)?.meaning;
  if (!m) return null;
  return <span className={cx("text-xs italic text-muted", className)}>{m}</span>;
}

const TYPE_TONE: Record<string, "accent" | "neutral" | "warn"> = { Aktif: "accent", Pasif: "neutral", Tepki: "warn" };

export function StatBadge({ stat }: { stat: keyof typeof UC_STAT_LABELS }) {
  return (
    <span
      data-tip-src="uc"
      data-tip-kind="stats"
      data-tip-key={stat}
      data-tip-title={UC_STAT_LABELS[stat]}
      className="inline-flex cursor-help items-center rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent"
    >
      {UC_STAT_LABELS[stat]}
    </span>
  );
}

export function UcAbilityCard({
  ability: a,
  footer,
  highlight,
}: {
  ability: UcAbility;
  /** Kartın içinde, en altta gösterilen eylem satırı (seç / aç düğmesi). */
  footer?: ReactNode;
  highlight?: "owned" | "available" | "locked";
}) {
  const loc = useLocale();
  const t = useT();
  const req = !a.requirementText || /^(yok|none)$/i.test(a.requirementText) ? null : a.requirementText;
  const type = ucBaseType(a.type);
  return (
    <article
      id={a.key}
      className={cx(
        "card flex scroll-mt-24 flex-col p-4",
        a.signature && "border-accent/45 bg-gradient-to-b from-accent/[0.06] to-transparent",
        highlight === "owned" && "border-accent ring-1 ring-accent/60",
        highlight === "available" && "border-ok/60",
        highlight === "locked" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <UcAbilityIcon type={type} signature={a.signature} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-serif text-lg leading-snug text-ink">
              {a.name}
              <UcTipButton kind="abilities" id={a.key} title={a.name} />
            </h3>
            <UcMeaning kind="abilities" id={a.key} />
          </div>
        </div>
        {!a.signature ? (
          <span className="shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{t("{n} sv", { n: a.maxLevel })}</span>
        ) : (
          <span className="shrink-0 rounded-md border border-accent/50 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent" title={t("Vertex: dalın tek seviyeli, ağır gereksinimli zirve yeteneği")}>
            Vertex
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={TYPE_TONE[type] ?? "neutral"}>{t(type)}</Badge>
        <Badge>{t(TIER_LABEL[a.tier])}</Badge>
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-wider">{t("Gereksinim:")}</span>{" "}
        {req ? <span className="prose-shz inline text-ink/90" dangerouslySetInnerHTML={{ __html: ucEnrich(req, loc) }} /> : <span className="text-ink/80">{t("yok")}</span>}
      </p>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
        {a.levelEffects.length > 0 && (
          <ol className="space-y-2">
            {a.levelEffects.map((l) => (
              <li key={l.level} className="grid grid-cols-[52px_1fr] gap-3 rounded-lg border border-line bg-surface2/50 px-3 py-2.5">
                <span className="grid h-7 place-items-center rounded-md bg-surface font-mono text-xs font-semibold text-accent">{t("Sv {n}", { n: l.level })}</span>
                <UcHtml html={l.html} />
              </li>
            ))}
          </ol>
        )}
        {a.sections.map((s) => (
          <div
            key={s.key}
            className={cx(
              "rounded-lg border-l-[3px] px-3 py-2.5",
              s.key === "BEDEL"
                ? "border-danger/70 bg-danger/[0.07]"
                : s.key === "SİNERJİ"
                  ? "border-lav/70 bg-lav/[0.07]"
                  : s.key === "ETKİ"
                    ? "border-accent/60 bg-accent/[0.06]"
                    : "border-line bg-surface2/50",
            )}
          >
            <p className={cx("mb-1 text-[11px] font-semibold uppercase tracking-widest", s.key === "BEDEL" ? "text-danger" : s.key === "SİNERJİ" ? "text-lav" : s.key === "ETKİ" ? "text-accent" : "text-muted")}>
              {loc === "en" ? t(s.key) : s.label}
            </p>
            <UcHtml html={s.html} />
          </div>
        ))}
        {a.flavorHtml && <UcHtml html={a.flavorHtml} className="border-t border-line pt-3 font-serif text-[13px] italic text-muted" />}
      </div>
      {footer && (
        <div className="mt-auto pt-3">
          <div className="border-t border-line pt-3">{footer}</div>
        </div>
      )}
    </article>
  );
}

export function UcPerkCard({
  perk: p,
  exclusiveNames,
  action,
  selected,
}: {
  perk: UcPerk;
  exclusiveNames?: string[];
  /** Kartın sağ altındaki eylem (seç düğmesi). */
  action?: ReactNode;
  selected?: boolean;
}) {
  const t = useT();
  const pos = p.kind === "positive";
  // Kurallar sayfasındaki süzgeç `hidden` özniteliğini kullanır: flex yalnızca eylemli kartta.
  return (
    <article
      id={p.key}
      data-perk-cat={p.category}
      data-perk-kind={p.kind}
      className={cx("card scroll-mt-24 p-4", !!action && "flex flex-col", selected && "border-accent bg-accent/[0.06] ring-1 ring-accent/60")}
    >
      <div className="flex items-start gap-3">
        <UcPerkIcon category={p.category} kind={p.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base leading-snug text-ink">{p.name}</h3>
            <UcTipButton kind="perks" id={p.key} title={p.name} />
            <span
              className={cx("rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold", pos ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}
              title={pos ? t("Perk puanı harcar") : t("Perk puanı kazandırır")}
            >
              {pos ? "−" : "+"}
              {p.points}
            </span>
            {p.category && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                <UcCategoryGlyph category={p.category} className="h-3 w-3" />
                {t(p.category)}
              </span>
            )}
          </div>
          <UcMeaning kind="perks" id={p.key} className="block" />
          <UcHtml html={p.html} className="mt-1 text-sm text-ink/80" />
          {exclusiveNames && exclusiveNames.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-lav">
              <span className="font-semibold uppercase tracking-wider">{t("Birlikte alınamaz:")}</span>
              {exclusiveNames.map((n) => (
                <span key={n} className="rounded border border-lav/40 px-1.5 py-0.5">
                  {n}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      {action && <div className="mt-auto flex justify-end pt-3">{action}</div>}
    </article>
  );
}

/** Sınıf sayfasında bir dalın özet kartı. */
export function UcDalCard({ dal: d, abilityNames, href }: { dal: UcDal; abilityNames: { key: string; name: string; signature: boolean }[]; href: string }) {
  const loc = useLocale();
  const t = useT();
  return (
    <a href={href} className="card group flex flex-col p-4 transition hover:border-accent/50">
      <div className="flex items-center gap-3">
        <UcDalIcon dalKey={d.key} tier={d.tier} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-serif text-lg text-ink group-hover:text-accent">
            {d.name}
            <UcTipButton kind="dals" id={d.key} title={d.name} />
          </p>
          <UcMeaning kind="dals" id={d.key} />
        </div>
        <StatBadge stat={d.stat} />
      </div>
      {d.identity && <p className="mt-2 text-sm text-ink/85">{d.identity}</p>}
      {d.startBonusText && <p className="mt-1 text-xs text-accent/90">{d.startBonusText}</p>}
      {d.mechanic && (
        <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border border-lav/45 bg-lav/10 px-2 py-0.5 text-[11px] font-semibold text-lav">
          {t("Dal mekaniği")} · {d.mechanic.title}
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {abilityNames.map((a) => (
          <li key={a.key} className={cx("chip", a.signature && "border-accent/50 text-accent")} title={ucTipFor("abilities", a.key, loc)?.meaning ?? undefined}>
            {a.name}
          </li>
        ))}
      </ul>
    </a>
  );
}
