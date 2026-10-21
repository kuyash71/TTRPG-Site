"use client";
import { useT } from "@/i18n/client";
import { BODY_PARTS, WOUNDS, type BodyPartKey } from "@/lib/shz/constants";
import type { PartState } from "@/lib/shz/rules";
import { cx } from "./ui";

// Önden görünüm; karakterin sağı izleyicinin solundadır.
const SHAPES: Record<BodyPartKey, { d: string; label: [number, number] }> = {
  head: { d: "M100 12a22 24 0 1 1 0 48a22 24 0 1 1 0-48zM90 60h20v12H90z", label: [100, 40] },
  "upper-torso": { d: "M66 76h68a10 10 0 0 1 10 10v58H56V86a10 10 0 0 1 10-10z", label: [100, 112] },
  "lower-torso": { d: "M58 148h84v40a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8z", label: [100, 172] },
  "r-arm": { d: "M34 80h18v86H34a6 6 0 0 1-6-6V88a8 8 0 0 1 6-8z", label: [41, 124] },
  "l-arm": { d: "M148 80h18a8 8 0 0 1 6 8v72a6 6 0 0 1-6 6h-18z", label: [159, 124] },
  "r-hand": { d: "M28 172h24v22a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z", label: [40, 188] },
  "l-hand": { d: "M148 172h24v22a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z", label: [160, 188] },
  "r-leg": { d: "M60 202h36v128H66a6 6 0 0 1-6-6z", label: [78, 266] },
  "l-leg": { d: "M104 202h36v122a6 6 0 0 1-6 6h-30z", label: [122, 266] },
  "r-foot": { d: "M56 336h40v18a6 6 0 0 1-6 6H62a6 6 0 0 1-6-6z", label: [76, 349] },
  "l-foot": { d: "M104 336h40v18a6 6 0 0 1-6 6h-28a6 6 0 0 1-6-6z", label: [124, 349] },
};

const FILL: Record<string, string> = {
  saglam: "rgb(var(--surface-2))",
  cizik: "rgb(226 180 92 / 0.35)",
  hafif: "rgb(226 160 92 / 0.55)",
  agir: "rgb(228 108 96 / 0.6)",
  kullanilamaz: "rgb(200 60 60 / 0.8)",
  kopuk: "rgb(60 20 24)",
};

export function BodyDiagram({
  body,
  selected,
  onSelect,
  className,
}: {
  body: Record<BodyPartKey, PartState>;
  selected?: BodyPartKey | null;
  onSelect?: (k: BodyPartKey) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <svg viewBox="0 0 200 368" className={cx("h-auto w-full max-w-[240px]", className)} role="img" aria-label={t("Beden tablosu")}>
      {BODY_PARTS.map((p) => {
        const s = SHAPES[p.key];
        const st = body[p.key];
        const isSel = selected === p.key;
        return (
          <g
            key={p.key}
            onClick={onSelect ? () => onSelect(p.key) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
            role={onSelect ? "button" : undefined}
            aria-label={`${t(p.label)}: ${t(WOUNDS.find((w) => w.key === st.wound)?.label ?? "")}`}
          >
            <title>{t(p.label)}</title>
            <path
              d={s.d}
              fill={FILL[st.wound]}
              stroke={isSel ? "rgb(var(--accent))" : st.augment ? "rgb(var(--accent) / 0.8)" : "rgb(var(--line))"}
              strokeWidth={isSel ? 2.5 : st.augment ? 2 : 1.2}
              strokeDasharray={st.bandage !== "yok" ? "4 2" : undefined}
            />
            {st.augment && (
              <circle cx={s.label[0]} cy={s.label[1]} r="4" fill="rgb(var(--accent))">
                <title>Augment</title>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function WoundLegend() {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      {WOUNDS.map((w) => (
        <span key={w.key} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line" style={{ background: FILL[w.key] }} />
          {t(w.label)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" /> Augment
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-3 border border-dashed border-muted" /> {t("Sargılı")}
      </span>
    </div>
  );
}
