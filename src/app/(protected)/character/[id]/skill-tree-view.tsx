"use client";

import { useState } from "react";
import { SkillTreeViewer } from "@/components/skill-tree/skill-tree-viewer";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";

interface Props {
  characterId: string;
  skillTreeNodes: DbSkillTreeNode[];
  unlockedMap: Record<string, number>;
  skillPoints: number;
  isOwner: boolean;
  isGm: boolean;
}

export function SkillTreeView({
  characterId,
  skillTreeNodes,
  unlockedMap,
  skillPoints,
  isOwner,
  isGm,
}: Props) {
  const [unlocks, setUnlocks] = useState(unlockedMap);
  const [points, setPoints] = useState(skillPoints);
  const [unlocking, setUnlocking] = useState(false);

  const rfUnlockedMap = new Map(Object.entries(unlocks));

  async function handleNodeClick(nodeId: string) {
    if (!isOwner && !isGm) return;
    if (unlocking) return;

    const node = skillTreeNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const currentLevel = unlocks[nodeId] || 0;
    if (currentLevel >= node.maxLevel) return;
    if (points < node.costPerLevel) return;

    const confirm = window.confirm(
      `"${node.name}" seviye ${currentLevel + 1}'e yükseltmek istediğinize emin misiniz? (${node.costPerLevel} SP)`
    );
    if (!confirm) return;

    setUnlocking(true);
    const res = await fetch(`/api/characters/${characterId}/skill-unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });

    if (res.ok) {
      const data = await res.json();
      setUnlocks((prev) => ({ ...prev, [nodeId]: data.newLevel }));
      setPoints(data.remainingPoints);
    } else {
      const data = await res.json();
      alert(data.error || "Bir hata oluştu.");
    }
    setUnlocking(false);
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="heading-gothic text-sm font-semibold text-zinc-300">
          Skill Tree
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">SP:</span>
          <span className="font-mono text-sm font-bold text-gold-400">{points}</span>
        </div>
      </div>
      <div className="h-[400px]">
        <SkillTreeViewer
          nodes={skillTreeNodes}
          unlockedMap={rfUnlockedMap}
          onNodeClick={(isOwner || isGm) ? handleNodeClick : undefined}
        />
      </div>
    </div>
  );
}
