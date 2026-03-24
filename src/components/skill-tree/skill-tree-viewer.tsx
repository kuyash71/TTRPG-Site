"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SkillNodeCard } from "./skill-node-card";
import { toReactFlowData, type DbSkillTreeNode } from "@/lib/skill-tree-utils";

const nodeTypes: NodeTypes = {
  skillNode: SkillNodeCard as unknown as NodeTypes["skillNode"],
};

interface Props {
  nodes: DbSkillTreeNode[];
  /** Oyuncu unlock seviyeleri: nodeId → currentLevel */
  unlockedMap?: Map<string, number>;
  /** Node tıklandığında (örn. skill açma butonu) */
  onNodeClick?: (nodeId: string) => void;
  /** true ise ReactFlow scroll yakalamaz, parent scroll çalışır */
  preventScrolling?: boolean;
}

export function SkillTreeViewer({ nodes: dbNodes, unlockedMap, onNodeClick, preventScrolling = true }: Props) {
  const { nodes, edges } = toReactFlowData(dbNodes, unlockedMap);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        preventScrolling={preventScrolling}
        zoomOnScroll={!preventScrolling ? false : undefined}
        panOnScroll={false}
        className="bg-void"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} />
        <Controls
          showInteractive={false}
          className="!bg-surface !border-border [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-zinc-400"
        />
        <MiniMap
          className="!bg-surface !border-border"
          nodeColor="#a78bfa"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
