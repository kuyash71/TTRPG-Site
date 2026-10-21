"use client";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useAction } from "@/components/interactive";
import { useT } from "@/i18n/client";
import { Badge, Button, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { UC_DAL_COUNTERS, UC_SKY_LABEL, ucSkyState } from "@/lib/uc/mechanics";
import type { UcStats } from "@/lib/uc/rules";
import { UcHtml } from "./cards";
import { UcDalIcon } from "./icons";

interface Props {
  characterId: string;
  trees: string[];
  dals: Record<string, { name: string; tier: 1 | 2 | 3 }>;
  mechanics: Record<string, { title: string; html: string }>;
  stats: UcStats;
  corruption: number;
  abilities: Record<string, number>;
  counters: Record<string, number>;
  notes: Record<string, string>;
  canEdit: boolean;
  onSaved: () => void;
}

/** Karakterin dallarındaki mekanikler (Akış, Düello, Lütuf...): sayaçlar, notlar ve kural metni. */
export function UcMechanicsCard(p: Props) {
  const t = useT();
  const owned = p.trees.filter((k) => p.mechanics[k]);
  if (!owned.length) return null;
  return (
    <div className="card space-y-5 p-5" data-testid="uc-mechanics">
      <h2 className="font-serif text-lg">{t("Dal mekanikleri")}</h2>
      {owned.map((k) => (
        <DalMechanic key={k} dalKey={k} {...p} />
      ))}
    </div>
  );
}

function DalMechanic({ dalKey, characterId, dals, mechanics, stats, corruption, abilities, counters, notes, canEdit, onSaved }: Props & { dalKey: string }) {
  const t = useT();
  const m = mechanics[dalKey];
  const defs = (UC_DAL_COUNTERS[dalKey] ?? []).filter((d) => !d.needs || (abilities[d.needs] ?? 0) > 0);
  const listened = (counters["gok-dinleme"] ?? 0) > 0;
  return (
    <section className="rounded-xl border border-lav/35 bg-lav/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <UcDalIcon dalKey={dalKey} tier={dals[dalKey]?.tier ?? 3} className="h-8 w-8" />
        <p className="font-serif text-base text-ink">
          {dals[dalKey]?.name} · <span className="text-lav">{m.title}</span>
        </p>
        {dalKey === "divine" && (
          <Badge tone={ucSkyState(corruption, listened) === "acik" ? "accent" : ucSkyState(corruption, listened) === "sustu" ? "warn" : "neutral"}>
            {t("Gök: {state}", { state: t(UC_SKY_LABEL[ucSkyState(corruption, listened)]) })}
          </Badge>
        )}
      </div>
      {defs.length > 0 && (
        <div className="grid gap-2">
          {defs.map((d) => (
            <Counter
              key={d.key}
              characterId={characterId}
              k={d.key}
              label={t(d.label)}
              hint={t(d.hint)}
              max={d.max?.(stats, { corruption, abilities })}
              maxText={d.maxText ? t(d.maxText) : undefined}
              flag={!!d.flag}
              value={counters[d.key] ?? 0}
              note={d.notes ? (notes[d.key] ?? "") : null}
              notePlaceholder={d.notes ? t(d.notes) : undefined}
              canEdit={canEdit}
              onSaved={onSaved}
            />
          ))}
        </div>
      )}
      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-sm text-lav hover:underline">
          <span className="group-open:hidden">{t("Kuralı göster ▾")}</span>
          <span className="hidden group-open:inline">{t("Kuralı gizle ▴")}</span>
        </summary>
        <UcHtml html={m.html} className="mt-2 text-sm" />
      </details>
    </section>
  );
}

function Counter({
  characterId,
  k,
  label,
  hint,
  max,
  maxText,
  value,
  note,
  notePlaceholder,
  canEdit,
  onSaved,
  flag,
}: {
  flag: boolean;
  characterId: string;
  k: string;
  label: string;
  hint: string;
  max?: number;
  maxText?: string;
  value: number;
  note: string | null;
  notePlaceholder?: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const t = useT();
  const { busy, run } = useAction();
  const [v, setV] = useState(value);
  const [n, setN] = useState(note ?? "");
  const shown = max === undefined ? v : Math.min(v, max);
  const save = async (next: number) => {
    const clamped = Math.max(0, max === undefined ? next : Math.min(max, next));
    setV(clamped);
    const r = await run(() => api(`/api/uc/characters/${characterId}/counters`, { method: "PATCH", body: { key: k, value: clamped } }));
    if (r === undefined) setV(value);
  };
  const isFlag = flag;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5" data-testid={`counter-${k}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[8rem] flex-1">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="text-[11px] text-muted">{flag ? t("İşaret · {text}", { text: maxText ?? "" }) : maxText ? (max !== undefined ? t("Sınır: {text} (= {max})", { text: maxText, max }) : t("Sınır: {text}", { text: maxText })) : t("Sınırsız")}</p>
        </div>
        {isFlag ? (
          <Button size="sm" variant={shown ? "primary" : "outline"} disabled={!canEdit || busy} onClick={() => save(shown ? 0 : 1)}>
            {shown ? t("Evet") : t("Hayır")}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t("{label} azalt", { label })} disabled={!canEdit || busy || shown <= 0} onClick={() => save(shown - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-30">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-12 text-center font-mono text-lg text-ink" data-testid={`counter-${k}-value`}>
              {shown}
              {max !== undefined && <span className="text-xs text-muted">/{max}</span>}
            </span>
            <button
              type="button"
              aria-label={t("{label} artır", { label })}
              disabled={!canEdit || busy || (max !== undefined && shown >= max)}
              onClick={() => save(shown + 1)}
              className="grid h-8 w-8 place-items-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
            {max !== undefined && max > 1 && (
              <button type="button" disabled={!canEdit || busy || shown === max} onClick={() => save(max)} className="ml-1 rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:text-ink disabled:opacity-30">
                {t("Doldur")}
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink/75">{hint}</p>
      {note !== null && (
        <div className="mt-2 space-y-1.5">
          <textarea className="input text-sm" rows={3} maxLength={2000} placeholder={notePlaceholder} value={n} disabled={!canEdit} onChange={(e) => setN(e.target.value)} />
          {canEdit && n !== (note ?? "") && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  const r = await run(() => api(`/api/uc/characters/${characterId}/counters`, { method: "PATCH", body: { key: k, notes: n } }), t("Not kaydedildi."));
                  if (r !== undefined) onSaved();
                }}
              >
                {t("Notu kaydet")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
