"use client";

import { useMemo, useState } from "react";
import { calculateAllStats } from "@/lib/stat-engine";
import type { FormulaNode } from "@/lib/stat-engine";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";
import type { WizardStatGroup } from "./character-wizard";
import { SkillTreeViewer } from "@/components/skill-tree/skill-tree-viewer";

interface Props {
  classId: string | null;
  skillTreeNodes: DbSkillTreeNode[];
  skillAllocations: Record<string, number>;
  maxPoints: number;
  statGroups: WizardStatGroup[];
  onChange: (allocations: Record<string, number>) => void;
}

export function WizardStepSkills({
  classId,
  skillTreeNodes,
  skillAllocations,
  maxPoints,
  statGroups,
  onChange,
}: Props) {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Kullanılabilir node'lar: ortak + seçilen sınıf
  const availableNodes = useMemo(() => {
    return skillTreeNodes.filter(
      (n) => !n.classId || n.classId === classId
    );
  }, [skillTreeNodes, classId]);

  const commonNodes = useMemo(() => availableNodes.filter((n) => !n.classId), [availableNodes]);
  const classNodes = useMemo(() => availableNodes.filter((n) => !!n.classId), [availableNodes]);

  const spentPoints = Object.values(skillAllocations).reduce((sum, v) => sum + v, 0);
  const remainingPoints = maxPoints - spentPoints;

  // Stat önizlemesi
  const previewStats = useMemo(() => {
    const unlocks = Object.entries(skillAllocations)
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
  }, [skillAllocations, skillTreeNodes, statGroups]);

  function allocate(nodeId: string, delta: number) {
    const node = availableNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const current = skillAllocations[nodeId] || 0;
    const next = Math.max(0, Math.min(node.maxLevel, current + delta));
    const cost = (next - current) * node.costPerLevel;

    if (cost > remainingPoints && delta > 0) return;

    onChange({ ...skillAllocations, [nodeId]: next });
  }

  // Prerequisite kontrolü
  function canAllocate(node: DbSkillTreeNode): boolean {
    if (node.unlockLevel > 1) return false; // Wizard'da karakter level 1
    for (const prereqId of node.prerequisites) {
      const prereqLevel = skillAllocations[prereqId] || 0;
      if (prereqLevel <= 0) return false;
    }
    return true;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="heading-gothic text-lg font-semibold text-zinc-100">
            Yetenek Puanları Dağıt
          </h2>
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-gold-400 text-void"
                  : "bg-surface text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-gold-400 text-void"
                  : "bg-surface text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Harita
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Kalan:</span>
          <span className={`font-mono text-lg font-bold ${remainingPoints > 0 ? "text-gold-400" : "text-zinc-500"}`}>
            {remainingPoints}
          </span>
          <span className="text-xs text-zinc-500">/ {maxPoints}</span>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sol: Node listesi veya harita */}
        <div className="flex-1">
          {viewMode === "list" ? (
            <div className="space-y-4">
              {availableNodes.length === 0 && (
                <p className="py-10 text-center text-sm text-zinc-500">
                  Henüz skill tree node&apos;u tanımlanmamış.
                </p>
              )}

              {/* Ortak Ağaç */}
              {commonNodes.length > 0 && (
                <div>
                  <h3 className="heading-gothic mb-2 border-b border-border pb-1 text-xs font-semibold text-zinc-400">
                    Ortak Ağaç
                  </h3>
                  <div className="space-y-2">
                    {commonNodes.map((node) => (
                      <SkillNodeRow
                        key={node.id}
                        node={node}
                        allocated={skillAllocations[node.id] || 0}
                        canUse={canAllocate(node)}
                        remainingPoints={remainingPoints}
                        onAllocate={(delta) => allocate(node.id, delta)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sınıf Ağacı */}
              {classNodes.length > 0 && (
                <div>
                  <h3 className="heading-gothic mb-2 border-b border-gold-900/30 pb-1 text-xs font-semibold text-gold-400">
                    Sınıf Ağacı
                  </h3>
                  <div className="space-y-2">
                    {classNodes.map((node) => (
                      <SkillNodeRow
                        key={node.id}
                        node={node}
                        allocated={skillAllocations[node.id] || 0}
                        canUse={canAllocate(node)}
                        remainingPoints={remainingPoints}
                        onAllocate={(delta) => allocate(node.id, delta)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[500px] overflow-hidden rounded-lg border border-border">
              <SkillTreeViewer
                nodes={availableNodes}
                unlockedMap={new Map(
                  Object.entries(skillAllocations).filter(([, v]) => v > 0)
                )}
                onNodeClick={(nodeId) => {
                  const node = availableNodes.find((n) => n.id === nodeId);
                  if (node && canAllocate(node)) {
                    allocate(nodeId, 1);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Stat önizleme */}
        <div className="w-56 flex-shrink-0">
          <h3 className="heading-gothic mb-2 text-xs font-semibold text-zinc-400">
            Stat Önizleme
          </h3>
          <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
            {previewStats.length === 0 && (
              <p className="text-xs text-zinc-600">Henüz stat yok.</p>
            )}
            {previewStats.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{s.label || s.key}</span>
                <span className="font-mono text-xs font-medium text-zinc-100">
                  {s.type === "RESOURCE" ? `${s.currentValue}/${s.maxValue}` : s.currentValue}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillNodeRow({
  node,
  allocated,
  canUse,
  remainingPoints,
  onAllocate,
}: {
  node: DbSkillTreeNode;
  allocated: number;
  canUse: boolean;
  remainingPoints: number;
  onAllocate: (delta: number) => void;
}) {
  const bonuses = (node.statBonusesPerLevel ?? {}) as Record<string, number>;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        !canUse
          ? "border-border bg-void opacity-50"
          : allocated > 0
            ? "border-gold-400/50 bg-gold-900/10"
            : "border-border bg-surface"
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-100">{node.name}</span>
          <span className="text-[10px] text-zinc-500">
            ({node.costPerLevel} SP/lv)
          </span>
        </div>
        {node.description && (
          <p className="mt-0.5 text-xs text-zinc-500">{node.description}</p>
        )}
        {Object.keys(bonuses).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(bonuses).map(([key, val]) => (
              <span key={key} className="text-[10px] text-lavender-400">
                {key} +{val}/lv
              </span>
            ))}
          </div>
        )}
      </div>

      {canUse && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAllocate(-1)}
            disabled={allocated <= 0}
            className="h-7 w-7 rounded bg-surface-raised text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
          >
            -
          </button>
          <span className="w-6 text-center font-mono text-sm text-zinc-100">
            {allocated}
          </span>
          <button
            onClick={() => onAllocate(1)}
            disabled={allocated >= node.maxLevel || remainingPoints < node.costPerLevel}
            className="h-7 w-7 rounded bg-surface-raised text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
          >
            +
          </button>
          <span className="text-[10px] text-zinc-600">
            /{node.maxLevel}
          </span>
        </div>
      )}
    </div>
  );
}
