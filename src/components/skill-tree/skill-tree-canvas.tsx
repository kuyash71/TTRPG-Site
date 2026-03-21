"use client";

import { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SkillNodeCard } from "./skill-node-card";
import { NodeEditorPanel } from "./node-editor-panel";
import {
  toReactFlowData,
  extractPositionUpdates,
  type DbSkillTreeNode,
  type SkillTreeNodeData,
} from "@/lib/skill-tree-utils";
import { wouldCreateCycle } from "@/lib/cycle-detection";

const nodeTypes: NodeTypes = {
  skillNode: SkillNodeCard as unknown as NodeTypes["skillNode"],
};

interface SpellOption {
  id: string;
  name: string;
}

interface Props {
  gamesetId: string;
  classId: string | null;
  initialNodes: DbSkillTreeNode[];
  statKeys: string[];
  spellDefinitions?: SpellOption[];
}

export function SkillTreeCanvas({ gamesetId, classId, initialNodes, statKeys, spellDefinitions }: Props) {
  const initial = toReactFlowData(initialNodes);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allDbNodes = useRef<DbSkillTreeNode[]>(initialNodes);

  const selectedNodeData = selectedNodeId
    ? (nodes.find((n) => n.id === selectedNodeId)?.data as SkillTreeNodeData | undefined)
    : null;

  const allNodeDatas = nodes.map((n) => n.data as SkillTreeNodeData);

  // Edge bağlama — döngü kontrolü ile
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Döngü kontrolü
      const graphNodes = allDbNodes.current.map((n) => ({
        id: n.id,
        prerequisites: n.prerequisites,
      }));
      if (wouldCreateCycle(graphNodes, connection.target, connection.source)) {
        alert("Bu bağlantı döngü oluşturur!");
        return;
      }

      setEdges((eds) =>
        addEdge(
          { ...connection, animated: true, style: { stroke: "#a78bfa" } },
          eds
        )
      );

      // API'ye prerequisite ekle
      const targetNode = allDbNodes.current.find((n) => n.id === connection.target);
      if (targetNode) {
        const newPrereqs = [...targetNode.prerequisites, connection.source];
        targetNode.prerequisites = newPrereqs;
        fetch(`/api/gamesets/${gamesetId}/skill-tree/${connection.target}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prerequisites: newPrereqs }),
        });
      }
    },
    [gamesetId, setEdges]
  );

  // Node seçimi
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Pozisyon kaydetme (drag sonrası)
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      const dbNode = allDbNodes.current.find((n) => n.id === node.id);
      if (dbNode) {
        dbNode.posX = node.position.x;
        dbNode.posY = node.position.y;
      }
      await fetch(`/api/gamesets/${gamesetId}/skill-tree/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: node.position.x, posY: node.position.y }),
      });
    },
    [gamesetId]
  );

  // Yeni node ekleme
  async function addNode() {
    const posX = Math.random() * 400 + 100;
    const posY = Math.random() * 400 + 100;

    const res = await fetch(`/api/gamesets/${gamesetId}/skill-tree`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Yeni Node",
        classId,
        nodeType: "PASSIVE",
        posX,
        posY,
      }),
    });

    if (!res.ok) return;
    const created: DbSkillTreeNode = await res.json();
    allDbNodes.current = [...allDbNodes.current, created];

    const { nodes: newNodes, edges: newEdges } = toReactFlowData(allDbNodes.current);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeId(created.id);
  }

  // Node güncelle
  async function handleNodeSave(updated: Partial<SkillTreeNodeData> & { id: string }) {
    const res = await fetch(`/api/gamesets/${gamesetId}/skill-tree/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!res.ok) return;
    const saved: DbSkillTreeNode = await res.json();

    allDbNodes.current = allDbNodes.current.map((n) => (n.id === saved.id ? saved : n));
    const { nodes: newNodes, edges: newEdges } = toReactFlowData(allDbNodes.current);
    setNodes(newNodes);
    setEdges(newEdges);
  }

  // Node sil
  async function handleNodeDelete(nodeId: string) {
    const res = await fetch(`/api/gamesets/${gamesetId}/skill-tree/${nodeId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Silinemedi.");
      return;
    }

    allDbNodes.current = allDbNodes.current.filter((n) => n.id !== nodeId);
    // Prerequisite'lerden de temizle
    allDbNodes.current = allDbNodes.current.map((n) => ({
      ...n,
      prerequisites: n.prerequisites.filter((p) => p !== nodeId),
    }));

    const { nodes: newNodes, edges: newEdges } = toReactFlowData(allDbNodes.current);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedNodeId(null);
  }

  // Toplu pozisyon kaydet
  async function saveAllPositions() {
    setSaving(true);
    const updates = extractPositionUpdates(nodes);
    await Promise.all(
      updates.map((u) =>
        fetch(`/api/gamesets/${gamesetId}/skill-tree/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posX: u.posX, posY: u.posY }),
        })
      )
    );
    setSaving(false);
  }

  // Doğrulama
  async function handleValidate() {
    const res = await fetch(`/api/gamesets/${gamesetId}/skill-tree/validate`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.valid) {
      alert(`Ağaç geçerli! (${data.nodeCount} node)`);
    } else {
      alert(`Hatalar:\n${data.errors.join("\n")}`);
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <button
            onClick={addNode}
            className="rounded-md bg-gold-600 px-3 py-1.5 text-xs font-medium text-void hover:bg-gold-500 shadow"
          >
            + Node Ekle
          </button>
          <button
            onClick={saveAllPositions}
            disabled={saving}
            className="rounded-md bg-surface-raised px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 shadow disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Pozisyonları Kaydet"}
          </button>
          <button
            onClick={handleValidate}
            className="rounded-md bg-surface-raised px-3 py-1.5 text-xs font-medium text-lavender-400 hover:text-lavender-300 shadow"
          >
            Doğrula
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-void"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#27272a" gap={20} />
          <Controls className="!bg-surface !border-border [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-zinc-400" />
          <MiniMap
            className="!bg-surface !border-border"
            nodeColor="#a78bfa"
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>

      {/* Side panel */}
      {selectedNodeData && (
        <NodeEditorPanel
          node={selectedNodeData}
          allNodes={allNodeDatas}
          statKeys={statKeys}
          spellDefinitions={spellDefinitions}
          onSave={handleNodeSave}
          onDelete={handleNodeDelete}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );
}
