"use client";

import { useState } from "react";
import type { StatGroupData, StatDefData } from "./gameset-editor";
import { FormulaBuilder } from "./formula-builder";

interface Props {
  gamesetId: string;
  statGroups: StatGroupData[];
  onUpdate: (groups: StatGroupData[]) => void;
}

export function StatDefinitionsTab({ gamesetId, statGroups, onUpdate }: Props) {
  const [groups, setGroups] = useState<StatGroupData[]>(statGroups);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    groups[0]?.id ?? null
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [editingDef, setEditingDef] = useState<StatDefData | null>(null);
  const [showDefForm, setShowDefForm] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  function updateState(updated: StatGroupData[]) {
    setGroups(updated);
    onUpdate(updated);
  }

  // ─── Grup CRUD ──────────────────────────────────────────

  async function addGroup() {
    if (!newGroupName.trim()) return;
    const res = await fetch(`/api/gamesets/${gamesetId}/stat-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newGroupName,
        sortOrder: groups.length,
      }),
    });
    if (!res.ok) return;
    const group = await res.json();
    const updated = [...groups, { ...group, definitions: [] }];
    updateState(updated);
    setSelectedGroupId(group.id);
    setNewGroupName("");
  }

  async function deleteGroup(groupId: string) {
    const res = await fetch(
      `/api/gamesets/${gamesetId}/stat-groups/${groupId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    const updated = groups.filter((g) => g.id !== groupId);
    updateState(updated);
    if (selectedGroupId === groupId) {
      setSelectedGroupId(updated[0]?.id ?? null);
    }
  }

  // ─── Stat Def CRUD ─────────────────────────────────────

  async function saveDef(def: Omit<StatDefData, "id"> & { id?: string }) {
    if (def.id) {
      // Update
      const res = await fetch(
        `/api/gamesets/${gamesetId}/stat-definitions/${def.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(def),
        }
      );
      if (!res.ok) return;
      const updated = await res.json();
      const newGroups = groups.map((g) => ({
        ...g,
        definitions: g.definitions.map((d) =>
          d.id === updated.id ? { ...d, ...updated } : d
        ),
      }));
      updateState(newGroups);
    } else {
      // Create
      const res = await fetch(
        `/api/gamesets/${gamesetId}/stat-definitions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...def,
            groupId: selectedGroupId,
            sortOrder: selectedGroup?.definitions.length ?? 0,
          }),
        }
      );
      if (!res.ok) return;
      const created = await res.json();
      const newGroups = groups.map((g) =>
        g.id === selectedGroupId
          ? { ...g, definitions: [...g.definitions, created] }
          : g
      );
      updateState(newGroups);
    }
    setEditingDef(null);
    setShowDefForm(false);
  }

  async function deleteDef(defId: string) {
    const res = await fetch(
      `/api/gamesets/${gamesetId}/stat-definitions/${defId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    const newGroups = groups.map((g) => ({
      ...g,
      definitions: g.definitions.filter((d) => d.id !== defId),
    }));
    updateState(newGroups);
  }

  return (
    <div className="flex gap-6">
      {/* Sol: Grup listesi */}
      <div className="w-56 flex-shrink-0 space-y-2">
        <h3 className="heading-gothic mb-2 text-xs font-semibold text-zinc-400">
          Stat Grupları
        </h3>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
              selectedGroupId === g.id
                ? "border-gold-400 bg-surface-raised text-gold-400"
                : "border-border bg-surface text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => setSelectedGroupId(g.id)}
          >
            <span>{g.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteGroup(g.id);
              }}
              className="text-zinc-600 hover:text-red-400"
              title="Grubu sil"
            >
              &times;
            </button>
          </div>
        ))}

        {/* Yeni grup */}
        <div className="flex gap-1">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
            placeholder="Yeni grup..."
            className="flex-1 rounded-md border border-border bg-void px-2 py-1.5 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
          <button
            onClick={addGroup}
            className="rounded-md bg-surface-raised px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100"
          >
            +
          </button>
        </div>
      </div>

      {/* Sağ: Seçili grubun stat tanımları */}
      <div className="flex-1">
        {selectedGroup ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="heading-gothic text-sm font-semibold text-zinc-200">
                {selectedGroup.name} — Stat Tanımları
              </h3>
              <button
                onClick={() => {
                  setEditingDef(null);
                  setShowDefForm(true);
                }}
                className="rounded-md bg-gold-600 px-3 py-1.5 text-xs font-medium text-void hover:bg-gold-500"
              >
                + Stat Ekle
              </button>
            </div>

            {/* Stat listesi */}
            <div className="space-y-2">
              {selectedGroup.definitions.map((def) => (
                <div
                  key={def.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface p-3"
                >
                  <div>
                    <span className="font-mono text-sm text-zinc-100">
                      {def.key}
                    </span>
                    <span className="ml-2 text-sm text-zinc-400">
                      {def.label}
                    </span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        def.type === "BASE"
                          ? "bg-lavender-900/50 text-lavender-400"
                          : def.type === "DERIVED"
                          ? "bg-blue-900/50 text-blue-400"
                          : "bg-green-900/50 text-green-400"
                      }`}
                    >
                      {def.type}
                    </span>
                    {!def.isPublic && (
                      <span className="ml-1 text-[10px] text-zinc-600">
                        (gizli)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingDef(def);
                        setShowDefForm(true);
                      }}
                      className="text-xs text-zinc-500 hover:text-lavender-400"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => deleteDef(def.id)}
                      className="text-xs text-zinc-500 hover:text-red-400"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}

              {selectedGroup.definitions.length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-600">
                  Bu grupta henüz stat tanımı yok.
                </p>
              )}
            </div>

            {/* Stat ekleme/düzenleme formu */}
            {showDefForm && (
              <StatDefForm
                initial={editingDef}
                allDefs={groups.flatMap((g) => g.definitions)}
                onSave={saveDef}
                onCancel={() => {
                  setShowDefForm(false);
                  setEditingDef(null);
                }}
              />
            )}
          </>
        ) : (
          <p className="py-20 text-center text-sm text-zinc-600">
            Sol taraftan bir stat grubu seçin veya yeni bir tane oluşturun.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stat Definition Form ─────────────────────────────────

interface StatDefFormProps {
  initial: StatDefData | null;
  allDefs: StatDefData[];
  onSave: (def: Omit<StatDefData, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

function StatDefForm({ initial, allDefs, onSave, onCancel }: StatDefFormProps) {
  const [form, setForm] = useState({
    key: initial?.key ?? "",
    label: initial?.label ?? "",
    type: initial?.type ?? "BASE",
    formula: initial?.formula ?? null,
    isPublic: initial?.isPublic ?? true,
    maxVal: initial?.maxVal ?? null,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...(initial ? { id: initial.id } : {}),
      key: form.key,
      label: form.label,
      type: form.type,
      formula: form.formula,
      isPublic: form.isPublic,
      maxVal: form.maxVal,
      sortOrder: initial?.sortOrder ?? 0,
    });
  }

  // DERIVED ve RESOURCE formül kullanabilecek BASE stat anahtarları
  const baseStatKeys = allDefs
    .filter((d) => d.type === "BASE")
    .map((d) => d.key);

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-raised p-4">
      <h4 className="heading-gothic mb-3 text-sm font-semibold text-zinc-200">
        {initial ? "Stat Düzenle" : "Yeni Stat"}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Anahtar (key)
            </label>
            <input
              type="text"
              value={form.key}
              onChange={(e) =>
                setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))
              }
              placeholder="STR"
              className="w-full rounded-md border border-border bg-void px-2 py-1.5 font-mono text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Etiket</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="Güç"
              className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Tip</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
            >
              <option value="BASE">BASE</option>
              <option value="DERIVED">DERIVED</option>
              <option value="RESOURCE">RESOURCE</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Maks. Değer
            </label>
            <input
              type="number"
              value={form.maxVal ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  maxVal: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="—"
              className="w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isPublic: e.target.checked }))
                }
                className="rounded border-border"
              />
              Herkese Görünür
            </label>
          </div>
        </div>

        {/* Formül (DERIVED veya RESOURCE ise) */}
        {(form.type === "DERIVED" || form.type === "RESOURCE") && (
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Formül
            </label>
            <FormulaBuilder
              value={form.formula}
              onChange={(formula) => setForm((f) => ({ ...f, formula }))}
              availableStats={baseStatKeys}
            />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded-md bg-gold-600 px-4 py-1.5 text-sm font-medium text-void hover:bg-gold-500"
          >
            {initial ? "Güncelle" : "Oluştur"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-surface px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
