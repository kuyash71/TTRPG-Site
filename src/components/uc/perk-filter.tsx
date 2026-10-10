"use client";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { UcCategoryGlyph } from "./icons";

/**
 * Perk listesinin üstündeki kategori süzgeci. Kartlar sunucuda çizilir; süzgeç yalnızca
 * data-perk-cat özniteliğine göre gizler/gösterir (JS yoksa hepsi görünür).
 */
export function UcPerkFilter({ categories, counts }: { categories: string[]; counts: Record<string, number> }) {
  const [cat, setCat] = useState<string | null>(null);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-perk-cat]").forEach((el) => {
      el.hidden = !!cat && el.dataset.perkCat !== cat;
    });
    document.querySelectorAll<HTMLElement>("[data-perk-section]").forEach((sec) => {
      sec.hidden = !sec.querySelector("[data-perk-cat]:not([hidden])");
    });
  }, [cat]);
  const btn = (key: string | null, label: React.ReactNode, n: number) => (
    <button
      key={key ?? "all"}
      type="button"
      aria-pressed={cat === key}
      onClick={() => setCat(key)}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
        cat === key ? "border-accent/60 bg-accent/15 text-ink" : "border-line text-muted hover:border-accent/40 hover:text-ink",
      )}
    >
      {label}
      <span className="font-mono text-[10px] text-muted">{n}</span>
    </button>
  );
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="toolbar" aria-label="Kategoriye göre süz">
      {btn(null, "Hepsi", Object.values(counts).reduce((a, b) => a + b, 0))}
      {categories.map((c) =>
        btn(
          c,
          <>
            <UcCategoryGlyph category={c} className="h-3.5 w-3.5" />
            {c}
          </>,
          counts[c] ?? 0,
        ),
      )}
    </div>
  );
}
