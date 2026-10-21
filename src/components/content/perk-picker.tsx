"use client";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import type { Perk } from "@/lib/shz/content-types";
import type { PerkBudget } from "@/lib/shz/rules";
import { Button, Card, cx } from "../ui";
import { PerkCard } from "./cards";
import { useT, useTLoose } from "@/i18n/client";

/** Perk seçimi: bütçe özeti, Pozitif / Negatif / Seçilenler sekmeleri, arama ve dışlama kontrolü. */
export function PerkPicker({ perks, selected, onToggle, budget }: { perks: Perk[]; selected: string[]; onToggle: (k: string) => void; budget: PerkBudget }) {
  const t = useT();
  const tLoose = useTLoose();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"positive" | "negative" | "selected">("positive");
  const name = useMemo(() => new Map(perks.map((p) => [p.key, p.name])), [perks]);
  const q = filter.toLocaleLowerCase("tr-TR");
  const visible = perks.filter((p) => (tab === "selected" ? selected.includes(p.key) : p.kind === tab) && (!q || p.searchText.includes(q)));
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span>
          {t("Başlangıç")} <strong className="font-mono">+{budget.start}</strong>
        </span>
        <span>
          {t("Negatiflerden")} <strong className="font-mono text-ok">+{budget.gained}</strong>
        </span>
        <span>
          {t("Pozitiflere")} <strong className="font-mono text-danger">−{budget.spent}</strong>
        </span>
        <span className={cx("ml-auto rounded-md px-2 py-1 font-mono", budget.left < 0 ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent")}>{t("Kalan {n}", { n: budget.left })}</span>
        <span className="w-full text-xs text-muted">
          {t("Toplam puan negatife düşmeden istediğin kadar perk alabilirsin. Kalan puan (Puan + 1) / 2 olarak stat puanına dönüşür: şu an {n} stat puanı.", { n: budget.convertible })}
        </span>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["positive", t("Pozitif ({n})", { n: perks.filter((p) => p.kind === "positive").length })],
              ["negative", t("Negatif ({n})", { n: perks.filter((p) => p.kind === "negative").length })],
              ["selected", t("Seçilenler ({n})", { n: selected.length })],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition",
                tab === k ? (k === "negative" ? "bg-danger/20 text-ink" : k === "positive" ? "bg-ok/20 text-ink" : "bg-accent/20 text-ink") : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input className="input min-w-[10rem] max-w-xs flex-1" placeholder={t("Perk ara…")} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {budget.problems.length > 0 && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{budget.problems.map(tLoose).join(" · ")}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((p) => {
          const on = selected.includes(p.key);
          const blockedBy = p.exclusive.find((x) => selected.includes(x));
          return (
            <PerkCard
              key={p.key}
              perk={p}
              selected={on}
              disabled={!!blockedBy && !on}
              blockedBy={blockedBy ? name.get(blockedBy) : null}
              exclusiveNames={p.exclusive.map((x) => name.get(x) ?? x)}
              action={
                <Button size="sm" variant={on ? "primary" : "secondary"} disabled={!!blockedBy && !on} onClick={() => onToggle(p.key)} title={blockedBy ? t("{name} ile birlikte alınamaz", { name: name.get(blockedBy) }) : undefined}>
                  {on ? t("Seçildi") : blockedBy ? <Lock className="h-3.5 w-3.5" /> : t("Seç")}
                </Button>
              }
            />
          );
        })}
        {!visible.length && <p className="text-sm text-muted">{t("Gösterilecek perk yok.")}</p>}
      </div>
    </div>
  );
}
