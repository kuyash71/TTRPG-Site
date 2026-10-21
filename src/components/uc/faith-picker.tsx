"use client";
import { Check, MoonStar } from "lucide-react";
import { cx } from "@/components/ui";
import { useT } from "@/i18n/client";
import type { UcFaith } from "@/lib/uc/content-types";
import { ucFaithKey } from "@/lib/uc/faith";
import { UcHtml } from "./cards";

/** Priest inanç seçimi: inanç kartları, varsa tanrı/yol/tarikat seçimi ve gerekirse ayrıntı alanı. */
export function UcFaithPicker({
  faiths,
  introHtml,
  value,
  detail,
  onChange,
  compact,
}: {
  faiths: UcFaith[];
  introHtml?: string;
  value: string | null;
  detail: string;
  onChange: (key: string | null, detail: string) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [fk, ok] = (value ?? "").split("/");
  return (
    <div className="space-y-3" data-testid="uc-faith-picker">
      {introHtml && !compact && <UcHtml html={introHtml} className="text-sm text-ink/85" />}
      <div className={cx("grid gap-3", !compact && "md:grid-cols-2")}>
        {faiths.map((f) => {
          const on = fk === f.key;
          return (
            <div
              key={f.key}
              className={cx("card relative flex flex-col gap-2 p-4 text-left transition", on ? "border-accent bg-accent/[0.07] ring-1 ring-accent/50" : "hover:border-accent/40", f.esoteric && "border-lav/40")}
            >
              <button
                type="button"
                aria-pressed={on}
                data-testid={`faith-${f.key}`}
                className="flex items-start justify-between gap-2 text-left"
                onClick={() => onChange(f.options.length ? (on ? value : f.key + "/" + f.options[0].key) : f.key, on ? detail : "")}
              >
                <span>
                  <span className="block font-serif text-lg text-ink">{f.name}</span>
                  {f.esoteric && <span className="text-[11px] font-semibold uppercase tracking-widest text-lav">{t("Gizli inanç")}</span>}
                </span>
                {on && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-onAccent">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </button>
              {f.html && <UcHtml html={f.html} className={cx("text-sm text-ink/85", !on && compact && "line-clamp-2")} />}
              {f.startCorruption > 0 && (
                <p className="flex items-center gap-1.5 rounded-md bg-lav/10 px-2 py-1 text-xs text-lav">
                  <MoonStar className="h-3.5 w-3.5" /> {t("Bu inançla oyuna +{n} Yozlaşma ile başlarsın.", { n: f.startCorruption })}
                </p>
              )}
              {f.options.length > 0 && (
                <div className="mt-1 space-y-1.5" role="radiogroup" aria-label={t("{name} seçimi", { name: f.short })}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{f.esoteric ? t("Tarikat") : f.options.some((o) => /yolu$|^path\b|\bpath$/i.test(o.name)) ? t("Yol") : t("Tanrı")}</p>
                  {f.options.map((o) => {
                    const sel = on && ok === o.key;
                    return (
                      <button
                        type="button"
                        key={o.key}
                        role="radio"
                        aria-checked={sel}
                        data-testid={`faith-${f.key}-${o.key}`}
                        onClick={() => onChange(ucFaithKey(f.key, o.key), "")}
                        className={cx(
                          "block w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                          sel ? "border-accent bg-accent/15 text-ink" : "border-line bg-surface2/40 text-ink/85 hover:border-accent/40",
                        )}
                      >
                        <span className="font-semibold">{o.name}</span>
                        {o.html && <UcHtml html={o.html} className="mt-0.5 text-[13px] text-ink/80" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {on && f.detailHint && (
                <label className="mt-1 block text-sm">
                  <span className="mb-1 block text-xs text-muted">{f.detailHint}</span>
                  <input className="input" value={detail} maxLength={60} data-testid={`faith-${f.key}-detail`} onChange={(e) => onChange(f.key, e.target.value)} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
