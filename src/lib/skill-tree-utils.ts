/**
 * Skill tree node'larını ReactFlow formatına dönüştürme ve geri alma.
 * @xyflow/react ile kullanılır.
 */

// ─── Types ──────────────────────────────────────────────

export interface SkillTreeNodeData {
  [key: string]: unknown;
  id: string;
  name: string;
  description: string;
  nodeType: "PASSIVE" | "ACTIVE" | "SPELL_UNLOCK";
  maxLevel: number;
  costPerLevel: number;
  unlockLevel: number;
  prerequisites: string[];
  statBonusesPerLevel: Record<string, number>;
  effect: unknown | null;
  classId: string | null;
  spellDefinitionId: string | null;
  /** Oyuncu görünümünde: bu node'un açılmış seviyesi */
  unlockedLevel?: number;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SkillTreeNodeData;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  style?: Record<string, string>;
}

/** DB'den gelen SkillTreeNode satırı */
export interface DbSkillTreeNode {
  id: string;
  name: string;
  description: string;
  nodeType: "PASSIVE" | "ACTIVE" | "SPELL_UNLOCK";
  maxLevel: number;
  costPerLevel: number;
  unlockLevel: number;
  prerequisites: string[];
  statBonusesPerLevel: unknown;
  effect: unknown | null;
  classId: string | null;
  spellDefinitionId: string | null;
  posX: number;
  posY: number;
}

// ─── Converters ─────────────────────────────────────────

/**
 * DB node'larını ReactFlow node ve edge'lerine dönüştürür.
 */
export function toReactFlowData(
  dbNodes: DbSkillTreeNode[],
  unlockedMap?: Map<string, number>
): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
} {
  const nodes: ReactFlowNode[] = dbNodes.map((n) => ({
    id: n.id,
    type: "skillNode",
    position: { x: n.posX, y: n.posY },
    data: {
      id: n.id,
      name: n.name,
      description: n.description,
      nodeType: n.nodeType,
      maxLevel: n.maxLevel,
      costPerLevel: n.costPerLevel,
      unlockLevel: n.unlockLevel,
      prerequisites: n.prerequisites,
      statBonusesPerLevel: (n.statBonusesPerLevel ?? {}) as Record<
        string,
        number
      >,
      effect: n.effect,
      classId: n.classId,
      spellDefinitionId: n.spellDefinitionId,
      unlockedLevel: unlockedMap?.get(n.id) ?? 0,
    },
  }));

  const edges: ReactFlowEdge[] = [];
  for (const node of dbNodes) {
    for (const prereqId of node.prerequisites) {
      edges.push({
        id: `${prereqId}->${node.id}`,
        source: prereqId,
        target: node.id,
        animated: true,
        style: { stroke: "#a78bfa" },
      });
    }
  }

  return { nodes, edges };
}

/**
 * ReactFlow node pozisyon değişikliklerini DB formatına çevirir.
 * Sadece pozisyon güncellemesi için (drag-drop sonrası).
 */
export function extractPositionUpdates(
  rfNodes: ReactFlowNode[]
): { id: string; posX: number; posY: number }[] {
  return rfNodes.map((n) => ({
    id: n.id,
    posX: n.position.x,
    posY: n.position.y,
  }));
}
