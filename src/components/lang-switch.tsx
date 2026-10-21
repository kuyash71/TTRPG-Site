"use client";
import { Languages } from "lucide-react";
import { useLocale, useT } from "@/i18n/client";
import type { Locale } from "@/i18n/core";
import { cx } from "./ui";

/** Sağ üstteki dil düğmesi: TR / EN. Seçim "lang" çerezine yazılır (SHZ ve UC ortak). */
export function LangSwitch({ className }: { className?: string }) {
  const loc = useLocale();
  const t = useT();
  const set = (l: Locale) => {
    if (l === loc) return;
    document.cookie = `lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  };
  return (
    <div role="group" aria-label={t("Dil")} className={cx("inline-flex items-center gap-0.5 rounded-md border border-line p-0.5 text-xs", className)} data-testid="lang-switch">
      <Languages className="mx-1 h-3.5 w-3.5 text-muted" aria-hidden />
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={loc === l}
          onClick={() => set(l)}
          data-testid={`lang-${l}`}
          className={cx("rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider transition", loc === l ? "bg-accent/20 text-ink" : "text-muted hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
