"use client";

import { useState, useEffect } from "react";
import type { SkillTreeNodeData } from "@/lib/skill-tree-utils";

interface Props {
  node: SkillTreeNodeData;
  allNodes: SkillTreeNodeData[];
  statKeys: string[];
  onSave: (updated: Partial<SkillTreeNodeData> & { id: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodeEditorPanel({ node, allNodes, statKeys, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState({
    name: node.name,
    description: node.description,
    nodeType: node.nodeType,
    maxLevel: node.maxLevel,
    costPerLevel: node.costPerLevel,
    unlockLevel: node.unlockLevel,
    prerequisites: node.prerequisites,
    statBonusesPerLevel: { ...node.statBonusesPerLevel },
  });

  useEffect(() => {
    setForm({
      name: node.name,
      description: node.description,
      nodeType: node.nodeType,
      maxLevel: node.maxLevel,
      costPerLevel: node.costPerLevel,
      unlockLevel: node.unlockLevel,
      prerequisites: node.prerequisites,
      statBonusesPerLevel: { ...node.statBonusesPerLevel },
    });
  }, [node]);

  // Prerequisite olarak seçilebilecek node'lar (kendisi hariç)
  const availablePrereqs = allNodes.filter((n) => n.id !== node.id);

  function togglePrereq(prereqId: string) {
    setForm((f) => ({
      ...f,
      prerequisites: f.prerequisites.includes(prereqId)
        ? f.prerequisites.filter((p) => p !== prereqId)
        : [...f.prerequisites, prereqId],
    }));
  }

  function setStatBonus(key: string, val: number) {
    setForm((f) => {
      const updated = { ...f.statBonusesPerLevel };
      if (val === 0) {
        delete updated[key];
      } else {
        updated[key] = val;
      }
      return { ...f, statBonusesPerLevel: updated };
    });
  }

  function handleSave() {
    onSave({ id: node.id, ...form });
  }

  return (
    <div className="w-80 flex-shrink-0 overflow-y-auto border-l border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="heading-gothic text-sm font-semibold text-zinc-200">
          Node Düzenle
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">&times;</button>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Ad</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Açıklama</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      {/* Type */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Tip</label>
        <select
          value={form.nodeType}
          onChange={(e) => setForm((f) => ({ ...f, nodeType: e.target.value as SkillTreeNodeData["nodeType"] }))}
          className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        >
          <option value="PASSIVE">PASSIVE</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SPELL_UNLOCK">SPELL_UNLOCK</option>
        </select>
      </div>

      {/* Max Level & Cost */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Maks Seviye</label>
          <input
            type="number"
            min={1}
            value={form.maxLevel}
            onChange={(e) => setForm((f) => ({ ...f, maxLevel: Number(e.target.value) }))}
            className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">SP/Seviye</label>
          <input
            type="number"
            min={1}
            value={form.costPerLevel}
            onChange={(e) => setForm((f) => ({ ...f, costPerLevel: Number(e.target.value) }))}
            className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Unlock Level */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Açılma Seviyesi</label>
        <input
          type="number"
          min={1}
          value={form.unlockLevel}
          onChange={(e) => setForm((f) => ({ ...f, unlockLevel: Number(e.target.value) }))}
          className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      {/* Stat Bonuses */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Stat Bonusları (seviye başı)</label>
        <div className="space-y-1">
          {statKeys.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-14 text-xs font-mono text-zinc-400">{key}</span>
              <input
                type="number"
                value={form.statBonusesPerLevel[key] ?? 0}
                onChange={(e) => setStatBonus(key, Number(e.target.value))}
                className="w-16 rounded border border-border bg-void px-1.5 py-1 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />
            </div>
          ))}
          {statKeys.length === 0 && (
            <p className="text-xs text-zinc-600">Henüz BASE stat tanımlanmamış.</p>
          )}
        </div>
      </div>

      {/* Prerequisites */}
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Ön Koşullar</label>
        <div className="max-h-32 overflow-y-auto space-y-1 rounded border border-border bg-void p-2">
          {availablePrereqs.length === 0 && (
            <p className="text-xs text-zinc-600">Başka node yok.</p>
          )}
          {availablePrereqs.map((n) => (
            <label key={n.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prerequisites.includes(n.id)}
                onChange={() => togglePrereq(n.id)}
                className="rounded border-border"
              />
              {n.name}
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          className="rounded-md bg-gold-600 px-3 py-1.5 text-xs font-medium text-void hover:bg-gold-500"
        >
          Kaydet
        </button>
        <button
          onClick={() => onDelete(node.id)}
          className="rounded-md bg-red-900/50 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900"
        >
          Sil
        </button>
      </div>
    </div>
  );
}
