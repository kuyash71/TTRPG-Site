"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SkillTreeNodeData } from "@/lib/skill-tree-utils";

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PASSIVE: { bg: "bg-lavender-900/30", border: "border-lavender-400/50", text: "text-lavender-400" },
  ACTIVE: { bg: "bg-blue-900/30", border: "border-blue-400/50", text: "text-blue-400" },
  SPELL_UNLOCK: { bg: "bg-green-900/30", border: "border-green-400/50", text: "text-green-400" },
};

function SkillNodeCardInner({ data, selected }: NodeProps & { data: SkillTreeNodeData }) {
  const colors = TYPE_COLORS[data.nodeType] ?? TYPE_COLORS.PASSIVE;
  const unlockedLevel = data.unlockedLevel ?? 0;
  const isUnlocked = unlockedLevel > 0;

  return (
    <div
      className={`relative min-w-[140px] rounded-lg border-2 px-3 py-2 transition-all ${
        colors.bg
      } ${selected ? "border-gold-400 shadow-lg shadow-gold-400/20" : colors.border} ${
        isUnlocked ? "ring-2 ring-gold-400/40" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-lavender-400 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-100 truncate">{data.name}</span>
        <span className={`text-[9px] font-medium rounded px-1 py-0.5 ${colors.text} ${colors.bg}`}>
          {data.nodeType}
        </span>
      </div>

      {/* Stats preview */}
      {Object.keys(data.statBonusesPerLevel).length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(data.statBonusesPerLevel).map(([key, val]) => (
            <span key={key} className="text-[10px] text-zinc-400">
              {key} +{val}
            </span>
          ))}
        </div>
      )}

      {/* Level & cost */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          Lv {unlockedLevel}/{data.maxLevel}
        </span>
        <span>{data.costPerLevel} SP/lv</span>
      </div>

      {/* Unlock level requirement */}
      {data.unlockLevel > 1 && (
        <div className="mt-0.5 text-[9px] text-zinc-600">
          Gerekli seviye: {data.unlockLevel}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-lavender-400 !w-2 !h-2" />
    </div>
  );
}

export const SkillNodeCard = memo(SkillNodeCardInner);
