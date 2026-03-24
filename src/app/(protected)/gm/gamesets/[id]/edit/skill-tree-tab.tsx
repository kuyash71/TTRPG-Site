"use client";

import { useState, useEffect, useCallback } from "react";
import { SkillTreeCanvas } from "@/components/skill-tree/skill-tree-canvas";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";
import type { ClassData, StatGroupData, SpellDefinitionData } from "./gameset-editor";

interface Props {
  gamesetId: string;
  skillTreeNodes: DbSkillTreeNode[];
  classes: ClassData[];
  statGroups: StatGroupData[];
  spellDefinitions: SpellDefinitionData[];
}

export function SkillTreeTab({ gamesetId, skillTreeNodes, classes, statGroups, spellDefinitions }: Props) {
  const [selectedTree, setSelectedTree] = useState<string>("common");
  const [nodes, setNodes] = useState<DbSkillTreeNode[]>(skillTreeNodes);
  const [loading, setLoading] = useState(false);

  const filteredNodes = selectedTree === "common"
    ? nodes.filter((n) => !n.classId)
    : nodes.filter((n) => n.classId === selectedTree);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gamesets/${gamesetId}/skill-tree`);
      if (res.ok) {
        const data: DbSkillTreeNode[] = await res.json();
        setNodes(data);
      }
    } finally {
      setLoading(false);
    }
  }, [gamesetId]);

  // Ağaç değiştiğinde güncel node'ları çek
  useEffect(() => {
    fetchNodes();
  }, [selectedTree, fetchNodes]);

  const baseStatKeys = statGroups
    .flatMap((g) => g.definitions)
    .filter((d) => d.type === "BASE")
    .map((d) => d.key);

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      {/* Ağaç seçici */}
      <div className="mb-3 flex items-center gap-2">
        <label className="text-xs text-zinc-400">Ağaç:</label>
        <select
          value={selectedTree}
          onChange={(e) => setSelectedTree(e.target.value)}
          className="rounded-md border border-border bg-void px-3 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        >
          <option value="common">Ortak Ağaç</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">
          ({filteredNodes.length} node)
        </span>
        {loading && <span className="text-xs text-zinc-600">Yükleniyor...</span>}
      </div>

      {/* Canvas */}
      <div className="flex-1 rounded-lg border border-border overflow-hidden">
        <SkillTreeCanvas
          key={selectedTree}
          gamesetId={gamesetId}
          classId={selectedTree === "common" ? null : selectedTree}
          initialNodes={filteredNodes}
          statKeys={baseStatKeys}
          spellDefinitions={spellDefinitions.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>
    </div>
  );
}
