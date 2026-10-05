import type { ReactNode } from "react";
import { enrichContent } from "@/lib/base";
import { KRIEGSVERSEHRT, STAT_LABELS, bodyPartLabel } from "@/lib/shz/constants";
import type { Ability, Augment, Perk } from "@/lib/shz/content-types";
import { Badge, cx } from "../ui";
import { branchMeaning } from "@/lib/shz/tips";
import { AbilityIcon, AugmentIcon, PerkIcon } from "./icons";
import { Meaning, TipButton } from "./tip";

export function Html({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={cx("prose-shz", className)} dangerouslySetInnerHTML={{ __html: enrichContent(html) }} />;
}

const TYPE_TONE: Record<string, "accent" | "neutral" | "warn"> = { Aktif: "accent", Pasif: "neutral", Tepki: "warn" };

export function branchLabel(a: Pick<Ability, "branch" | "branchName">) {
  if (a.branch === "Kök") return "Kök";
  return `${a.branch}${a.branchName ? ` · ${a.branchName}` : ""}`;
}

export function AbilityCard({
  ability: a,
  level,
  footer,
  compact,
  highlight,
  prereqName,
  prereqMissing,
}: {
  ability: Ability;
  level?: number;
  footer?: ReactNode;
  compact?: boolean;
  highlight?: "owned" | "available" | "locked";
  prereqName?: string | null;
  /** Öncül henüz alınmadıysa kırmızı gösterilir. */
  prereqMissing?: boolean;
}) {
  const req = !a.requirementText || /^yok$/i.test(a.requirementText) ? null : a.requirementText;
  return (
    <article
      id={a.key}
      className={cx(
        "card flex scroll-mt-24 flex-col p-4 transition",
        highlight === "owned" && "border-accent/60 bg-accent/[0.06]",
        highlight === "available" && "border-ok/50 shadow-[0_0_0_1px_rgb(var(--ok)/0.15)]",
        highlight === "locked" && "opacity-80",
      )}
    >
      {prereqName && (
        <p className={cx("-mt-1 mb-2 flex items-center gap-1.5 text-[11px] font-medium", prereqMissing ? "text-danger" : "text-warn")}>
          <span aria-hidden>↳</span> Öncül: <span className="font-semibold">{prereqName}</span>
          {prereqMissing && <span className="text-danger/80">(önce bunu al)</span>}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AbilityIcon abilityKey={a.key} type={a.type} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-serif text-lg leading-snug text-ink">
              {a.name}
              <TipButton kind="abilities" id={a.key} title={a.name} />
            </h3>
            <Meaning kind="abilities" id={a.key} />
          </div>
        </div>
        {level ? (
          <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 font-mono text-xs font-semibold text-onAccent">
            Sv {level}/{a.maxLevel}
          </span>
        ) : a.maxLevel > 1 ? (
          <span className="shrink-0 rounded-md border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{a.maxLevel} sv</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={TYPE_TONE[a.type] ?? "neutral"}>{a.type}</Badge>
        <Badge>
          {branchLabel(a)}
          {branchMeaning(a.branchName) && <span className="font-normal text-muted">({branchMeaning(a.branchName)})</span>}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-wider">Gereksinim:</span>{" "}
        {req ? <span className="prose-shz inline text-ink/90" dangerouslySetInnerHTML={{ __html: enrichContent(req) }} /> : <span className="text-ink/80">yok</span>}
      </p>
      {compact && a.levelEffects[0] && (
        <div className="prose-shz mt-2 line-clamp-2 text-sm text-ink/80" dangerouslySetInnerHTML={{ __html: enrichContent(a.levelEffects[0].html) }} />
      )}
      {!compact && (
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
          {a.levelEffects.length > 0 && (
            <ol className="space-y-2">
              {a.levelEffects.map((l) => {
                const on = !!level && l.level <= level;
                return (
                  <li key={l.level} className={cx("grid grid-cols-[52px_1fr] gap-3 rounded-lg border px-3 py-2.5", on ? "border-accent/40 bg-accent/10" : "border-line bg-surface2/50")}>
                    <span className={cx("grid h-7 place-items-center rounded-md font-mono text-xs font-semibold", on ? "bg-accent text-onAccent" : "bg-surface text-accent")}>Sv {l.level}</span>
                    <span className="prose-shz" dangerouslySetInnerHTML={{ __html: enrichContent(l.html) }} />
                  </li>
                );
              })}
            </ol>
          )}
          {a.sections.map((s) => (
            <div
              key={s.key}
              className={cx(
                "rounded-lg border-l-[3px] px-3 py-2.5",
                s.key === "BEDEL" ? "border-danger/70 bg-danger/[0.07]" : s.key === "SİNERJİ" ? "border-accent/70 bg-accent/[0.07]" : "border-line bg-surface2/50",
              )}
            >
              <p className={cx("mb-1 text-[11px] font-semibold uppercase tracking-widest", s.key === "BEDEL" ? "text-danger" : s.key === "SİNERJİ" ? "text-accent" : "text-muted")}>{s.label}</p>
              <Html html={s.html} />
            </div>
          ))}
          {a.flavorHtml && <Html html={a.flavorHtml} className="border-t border-line pt-3 font-serif text-[13px] italic text-muted" />}
        </div>
      )}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </article>
  );
}

export function PerkCard({
  perk: p,
  action,
  selected,
  disabled,
  exclusiveNames,
  blockedBy,
  pointsLabel,
}: {
  perk: Perk;
  /** Puan rozetini değiştir (ör. uzuv sayısına bağlı Kriegsversehrt) */
  pointsLabel?: string;
  action?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  exclusiveNames?: string[];
  blockedBy?: string | null;
}) {
  const pos = p.kind === "positive";
  return (
    <article id={p.key} className={cx("card scroll-mt-24 p-4 transition", selected && "border-accent/70 bg-accent/[0.07]", disabled && "opacity-55")}>
      <div className="flex items-start gap-3">
        <PerkIcon perkKey={p.key} kind={p.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base leading-snug text-ink">{p.name}</h3>
            <TipButton kind="perks" id={p.key} title={p.name} />
            <span
              className={cx("rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold", pos ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}
              title={pos ? "Perk puanı harcar" : "Perk puanı kazandırır"}
            >
              {pos ? "−" : "+"}
              {pointsLabel ?? (p.key === KRIEGSVERSEHRT.perk ? Object.values(KRIEGSVERSEHRT.points).join("/") : p.points)}
            </span>
          </div>
          <Meaning kind="perks" id={p.key} className="block" />
          <Html html={p.html} className="mt-1 text-sm text-ink/80" />
          {exclusiveNames && exclusiveNames.length > 0 && (
            <p className={cx("mt-2 flex flex-wrap items-center gap-1.5 text-[11px]", blockedBy ? "text-danger" : "text-warn")}>
              <span className="font-semibold uppercase tracking-wider">Birlikte alınamaz:</span>
              {exclusiveNames.map((n) => (
                <span key={n} className={cx("rounded border px-1.5 py-0.5", n === blockedBy ? "border-danger/60 bg-danger/10" : "border-warn/40")}>
                  {n}
                </span>
              ))}
            </p>
          )}
        </div>
        {action}
      </div>
    </article>
  );
}

export function AugmentCard({ augment: a, action }: { augment: Augment; action?: ReactNode }) {
  return (
    <article id={a.key} className="card flex scroll-mt-24 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AugmentIcon augmentKey={a.key} tier={a.tier ?? "T1"} />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-serif text-[17px] text-ink">
              {a.name}
              <TipButton kind="augments" id={a.key} title={a.name} />
            </h3>
            <Meaning kind="augments" id={a.key} />
          </div>
        </div>
        {a.tier && <Badge tone={a.tier === "T3" ? "danger" : a.tier === "T2" ? "warn" : "accent"}>{a.tier}</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {a.slots.map((s) => (
          <span key={s} className="chip">
            {bodyPartLabel(s)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {a.mods.map((m) => (
          <span key={m.stat} className={cx("rounded px-1.5 py-0.5 font-mono text-xs", m.value > 0 ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}>
            {m.value > 0 ? "+" : "−"}
            {Math.abs(m.value)} {STAT_LABELS[m.stat]}
          </span>
        ))}
      </div>
      {a.usageHtml && (
        <div className="mt-3 rounded-md border-l-2 border-line bg-surface2/50 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Kullanım</p>
          <Html html={a.usageHtml} className="text-sm" />
        </div>
      )}
      {a.extra.map((x) => (
        <div key={x.label} className="mt-2 rounded-md border-l-2 border-line bg-surface2/50 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">{x.label}</p>
          <Html html={x.html} className="text-sm" />
        </div>
      ))}
      {a.flavorHtml && <Html html={a.flavorHtml} className="mt-3 border-t border-line pt-3 font-serif text-[13px] italic text-muted" />}
      {action && <div className="mt-auto pt-3">{action}</div>}
    </article>
  );
}
