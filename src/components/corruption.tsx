"use client";
import { useT } from "@/i18n/client";
import { CORRUPTION_EFFECTS } from "@/lib/shz/constants";
import { MORS_SUPPRESSED_CORRUPTION } from "@/lib/shz/rules";
import { cx } from "./ui";

/** Corruption etkileri birikimlidir: 1'den mevcut seviyeye kadar her etki ayrı bir uyarı kutusunda. */
export function CorruptionEffects({ value, className, mors }: { value: number; className?: string; mors?: boolean }) {
  const t = useT();
  const levels = Array.from({ length: value }, (_, i) => i + 1);
  return (
    <ul className={cx("grid gap-2 sm:grid-cols-2", className)} aria-label={t("Aktif Corruption etkileri")}>
      {levels.map((lv) => (
        <li
          key={lv}
          className={cx(
            "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
            mors && MORS_SUPPRESSED_CORRUPTION.includes(lv) && "opacity-50 line-through decoration-muted/60",
            lv >= 9 ? "border-danger/50 bg-danger/10" : lv >= 5 ? "border-warn/50 bg-warn/10" : "border-accent/40 bg-accent/[0.07]",
          )}
        >
          <span
            className={cx(
              "grid h-6 min-w-6 shrink-0 place-items-center rounded font-mono text-xs font-semibold",
              lv >= 9 ? "bg-danger/25 text-danger" : lv >= 5 ? "bg-warn/25 text-warn" : "bg-accent/20 text-accent",
            )}
          >
            {lv}
          </span>
          <span>
            <span lang="en" className="font-medium text-ink">
              Corruption {lv}:
            </span>{" "}
            <span className="text-ink/85">{t(CORRUPTION_EFFECTS[lv])}</span>
            {mors && MORS_SUPPRESSED_CORRUPTION.includes(lv) && <span className="ml-1 inline-block text-xs text-lav no-underline">({t("Mors: işlemez")})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

