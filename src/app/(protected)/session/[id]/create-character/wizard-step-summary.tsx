"use client";

import { useMemo } from "react";
import { calculateAllStats } from "@/lib/stat-engine";
import type { FormulaNode } from "@/lib/stat-engine";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";
import type { GamesetConfig } from "@/types/gameset-config";
import type { WizardDraft, WizardRace, WizardClass, WizardStatGroup } from "./character-wizard";

interface Props {
  draft: WizardDraft;
  races: WizardRace[];
  classes: WizardClass[];
  skillTreeNodes: DbSkillTreeNode[];
  statGroups: WizardStatGroup[];
  config: GamesetConfig;
}

export function WizardStepSummary({
  draft,
  races,
  classes,
  skillTreeNodes,
  statGroups,
  config,
}: Props) {
  const selectedRace = races.find((r) => r.id === draft.raceId);
  const selectedClass = classes.find((c) => c.id === draft.classId);

  const spentPoints = Object.values(draft.skillAllocations).reduce((sum, v) => sum + v, 0);

  const allocatedNodes = Object.entries(draft.skillAllocations)
    .filter(([, lvl]) => lvl > 0)
    .map(([nodeId, lvl]) => {
      const node = skillTreeNodes.find((n) => n.id === nodeId);
      return { nodeId, level: lvl, name: node?.name || "?" };
    });

  const previewStats = useMemo(() => {
    const unlocks = Object.entries(draft.skillAllocations)
      .filter(([, lvl]) => lvl > 0)
      .map(([nodeId, currentLevel]) => ({ nodeId, currentLevel }));

    const nodes = skillTreeNodes.map((n) => ({
      id: n.id,
      statBonusesPerLevel: (n.statBonusesPerLevel ?? {}) as Record<string, number>,
    }));

    const allDefs = statGroups.flatMap((g) => g.definitions);
    const statDefs = allDefs.map((d) => ({
      key: d.key,
      label: d.label,
      type: d.type as "BASE" | "DERIVED" | "RESOURCE",
      formula: d.formula as FormulaNode | null,
      isPublic: d.isPublic,
      maxVal: d.maxVal,
    }));

    return calculateAllStats(statDefs, unlocks, nodes);
  }, [draft.skillAllocations, skillTreeNodes, statGroups]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="heading-gothic text-lg font-semibold text-zinc-100">
        Karakter Özeti
      </h2>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        {/* Temel bilgiler */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-zinc-500">Ad</span>
            <p className="text-sm font-medium text-zinc-100">{draft.name || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Irk</span>
            <p className="text-sm font-medium text-zinc-100">{selectedRace?.name || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Sınıf</span>
            <p className="text-sm font-medium text-zinc-100">{selectedClass?.name || "—"}</p>
          </div>
          <div>
            <span className="text-xs text-zinc-500">Seviye</span>
            <p className="text-sm font-medium text-zinc-100">1</p>
          </div>
        </div>

        {/* Skill puanları */}
        <div>
          <span className="text-xs text-zinc-500">Skill Puanları</span>
          <p className="text-sm text-zinc-300">
            {spentPoints} / {config.startingSkillPoints} harcandı
          </p>
          {allocatedNodes.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {allocatedNodes.map((n) => (
                <span
                  key={n.nodeId}
                  className="rounded bg-lavender-900/30 px-1.5 py-0.5 text-[10px] text-lavender-400"
                >
                  {n.name} Lv{n.level}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stat'lar */}
        {previewStats.length > 0 && (
          <div>
            <span className="text-xs text-zinc-500">Statlar</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {previewStats.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between rounded border border-border bg-void px-2 py-1"
                >
                  <span className="text-xs text-zinc-400">{s.label || s.key}</span>
                  <span className="font-mono text-xs font-medium text-zinc-100">
                    {s.type === "RESOURCE" ? `${s.currentValue}/${s.maxValue}` : s.currentValue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backstory */}
        {draft.backstory && (
          <div>
            <span className="text-xs text-zinc-500">Hikaye</span>
            <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-300">
              {draft.backstory}
            </p>
          </div>
        )}

        {/* Custom Fields */}
        {draft.customFields?.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-zinc-500">Ek Bilgiler</span>
            {draft.customFields.map((field) => (
              <div key={field.id} className="rounded border border-border bg-void p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-300">
                    {field.title || "Başlıksız"}
                  </span>
                  {field.isPrivate && (
                    <span className="rounded bg-red-900/30 px-1 py-0.5 text-[9px] text-red-400">
                      Gizli
                    </span>
                  )}
                </div>
                {field.content && (
                  <p className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-400">
                    {field.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        &ldquo;GM Onayına Gönder&rdquo; butonuna basarak karakterinizi GM onayına gönderirsiniz.
        GM onayladığında karakteriniz oluşturulacaktır.
      </p>
    </div>
  );
}
