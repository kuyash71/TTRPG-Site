"use client";

import { useState } from "react";
import type { ItemDefinitionData, StatGroupData } from "./gameset-editor";

const CATEGORIES = [
  { value: "WEAPON", label: "Silah" },
  { value: "ARMOR", label: "Zırh" },
  { value: "CONSUMABLE", label: "Sarf" },
  { value: "MATERIAL", label: "Malzeme" },
  { value: "QUEST", label: "Görev" },
  { value: "MISC", label: "Diğer" },
] as const;

const EQUIPMENT_SLOTS = [
  { value: "", label: "Yok (Kuşanılamaz)" },
  { value: "HEAD", label: "Baş" },
  { value: "CHEST", label: "Göğüs" },
  { value: "LEGS", label: "Bacak" },
  { value: "FEET", label: "Ayak" },
  { value: "MAIN_HAND", label: "Ana El" },
  { value: "OFF_HAND", label: "Yan El" },
  { value: "ACCESSORY_1", label: "Aksesuar 1" },
  { value: "ACCESSORY_2", label: "Aksesuar 2" },
] as const;

const RARITIES = [
  { value: "COMMON", label: "Sıradan", color: "border-zinc-600" },
  { value: "UNCOMMON", label: "Nadir Olmayan", color: "border-green-600" },
  { value: "RARE", label: "Nadir", color: "border-blue-600" },
  { value: "EPIC", label: "Epik", color: "border-purple-600" },
  { value: "LEGENDARY", label: "Efsanevi", color: "border-gold-400" },
] as const;

interface Props {
  gamesetId: string;
  items: ItemDefinitionData[];
  statGroups: StatGroupData[];
  onUpdate: (items: ItemDefinitionData[]) => void;
}

const emptyForm = {
  name: "",
  description: "",
  category: "MISC" as string,
  gridWidth: 1,
  gridHeight: 1,
  equipmentSlot: "" as string,
  statBonuses: {} as Record<string, number>,
  stackable: false,
  maxStack: 1,
  rarity: "COMMON" as string,
  usable: false,
  useStatReq: null as { stat: string; min: number } | null,
};

export function ItemsTab({ gamesetId, items, statGroups, onUpdate }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bonusKey, setBonusKey] = useState("");
  const [bonusVal, setBonusVal] = useState(0);

  const allStatKeys = statGroups.flatMap((g) =>
    g.definitions.map((d) => ({ key: d.key, label: d.label }))
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setBonusKey("");
    setBonusVal(0);
  }

  function startEdit(item: ItemDefinitionData) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      category: item.category,
      gridWidth: item.gridWidth,
      gridHeight: item.gridHeight,
      equipmentSlot: item.equipmentSlot || "",
      statBonuses: { ...(item.statBonuses as Record<string, number>) },
      stackable: item.stackable,
      maxStack: item.maxStack,
      rarity: item.rarity,
      usable: (item as unknown as Record<string, unknown>).usable as boolean ?? false,
      useStatReq: (item as unknown as Record<string, unknown>).useStatReq as { stat: string; min: number } | null ?? null,
    });
  }

  function addBonus() {
    if (!bonusKey || bonusVal === 0) return;
    setForm((prev) => ({
      ...prev,
      statBonuses: { ...prev.statBonuses, [bonusKey]: (prev.statBonuses[bonusKey] || 0) + bonusVal },
    }));
    setBonusKey("");
    setBonusVal(0);
  }

  function removeBonus(key: string) {
    setForm((prev) => {
      const next = { ...prev.statBonuses };
      delete next[key];
      return { ...prev, statBonuses: next };
    });
  }

  async function handleSubmit() {
    const body = {
      ...form,
      equipmentSlot: form.equipmentSlot || null,
      useStatReq: form.usable && form.useStatReq?.stat ? form.useStatReq : null,
    };

    if (editingId) {
      const res = await fetch(`/api/gamesets/${gamesetId}/items/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(items.map((i) => (i.id === editingId ? updated : i)));
        resetForm();
      }
    } else {
      const res = await fetch(`/api/gamesets/${gamesetId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        onUpdate([...items, created]);
        resetForm();
      }
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/gamesets/${gamesetId}/items/${id}`, { method: "DELETE" });
    if (res.ok) {
      onUpdate(items.filter((i) => i.id !== id));
      if (editingId === id) resetForm();
    }
  }

  const rarityColor = (r: string) =>
    RARITIES.find((x) => x.value === r)?.color ?? "border-zinc-600";

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <h3 className="heading-gothic text-sm font-semibold text-zinc-100">
          {editingId ? "Eşya Düzenle" : "Yeni Eşya"}
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-zinc-500">Ad</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Kategori</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Nadirlik</label>
            <select
              value={form.rarity}
              onChange={(e) => setForm((p) => ({ ...p, rarity: e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
            >
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">Açıklama</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Grid H</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.gridWidth}
              onChange={(e) => setForm((p) => ({ ...p, gridWidth: +e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Grid V</label>
            <input
              type="number"
              min={1}
              max={6}
              value={form.gridHeight}
              onChange={(e) => setForm((p) => ({ ...p, gridHeight: +e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Kuşanma Slotu</label>
            <select
              value={form.equipmentSlot}
              onChange={(e) => setForm((p) => ({ ...p, equipmentSlot: e.target.value }))}
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
            >
              {EQUIPMENT_SLOTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={form.stackable}
                onChange={(e) => setForm((p) => ({ ...p, stackable: e.target.checked }))}
                className="rounded"
              />
              Yığılabilir
            </label>
            {form.stackable && (
              <input
                type="number"
                min={1}
                value={form.maxStack}
                onChange={(e) => setForm((p) => ({ ...p, maxStack: +e.target.value }))}
                className="w-16 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
                title="Maks yığın"
              />
            )}
          </div>
        </div>

        {/* Kullanılabilirlik */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={form.usable}
              onChange={(e) => setForm((p) => ({ ...p, usable: e.target.checked, useStatReq: e.target.checked ? p.useStatReq : null }))}
              className="rounded"
            />
            Kullanılabilir Eşya
          </label>
          {form.usable && (
            <div className="ml-5 flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">Stat Şartı:</span>
              <select
                value={form.useStatReq?.stat || ""}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  useStatReq: e.target.value ? { stat: e.target.value, min: p.useStatReq?.min || 1 } : null,
                }))}
                className="rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
              >
                <option value="">Şart yok</option>
                {allStatKeys.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              {form.useStatReq?.stat && (
                <>
                  <span className="text-[11px] text-zinc-500">Min:</span>
                  <input
                    type="number"
                    min={1}
                    value={form.useStatReq.min}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      useStatReq: { stat: p.useStatReq!.stat, min: +e.target.value },
                    }))}
                    className="w-16 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Stat Bonusları */}
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Stat Bonusları</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(form.statBonuses).map(([key, val]) => (
              <span
                key={key}
                className="flex items-center gap-1 rounded bg-lavender-900/30 px-2 py-0.5 text-[11px] text-lavender-400"
              >
                {allStatKeys.find((s) => s.key === key)?.label || key}: {val > 0 ? `+${val}` : val}
                <button onClick={() => removeBonus(key)} className="ml-0.5 text-zinc-500 hover:text-red-400">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={bonusKey}
              onChange={(e) => setBonusKey(e.target.value)}
              className="rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
            >
              <option value="">Stat seç...</option>
              {allStatKeys.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={bonusVal}
              onChange={(e) => setBonusVal(+e.target.value)}
              className="w-16 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
              placeholder="+/-"
            />
            <button
              onClick={addBonus}
              disabled={!bonusKey || bonusVal === 0}
              className="rounded bg-lavender-600 px-2 py-1 text-xs text-white disabled:opacity-40"
            >
              Ekle
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            className="rounded bg-gold-600 px-4 py-1.5 text-sm font-medium text-void hover:bg-gold-500 disabled:opacity-50"
          >
            {editingId ? "Güncelle" : "Oluştur"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded bg-surface-raised px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Vazgeç
            </button>
          )}
        </div>
      </div>

      {/* Item List */}
      {items.length === 0 ? (
        <p className="text-center text-sm text-zinc-600">Henüz eşya tanımlanmamış.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border-2 bg-surface p-3 ${rarityColor(item.rarity)}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-zinc-100">{item.name}</h4>
                  <p className="text-[10px] text-zinc-500">
                    {CATEGORIES.find((c) => c.value === item.category)?.label} &middot;{" "}
                    {item.gridWidth}&times;{item.gridHeight}
                    {item.equipmentSlot && (
                      <> &middot; {EQUIPMENT_SLOTS.find((s) => s.value === item.equipmentSlot)?.label}</>
                    )}
                  </p>
                </div>
                <span className="text-[9px] text-zinc-600">
                  {RARITIES.find((r) => r.value === item.rarity)?.label}
                </span>
              </div>

              {item.description && (
                <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">{item.description}</p>
              )}

              {Boolean((item as unknown as Record<string, unknown>).usable) && (
                <span className="mt-1 inline-block rounded bg-gold-900/30 px-1.5 py-0.5 text-[10px] text-gold-400">
                  Kullanılabilir
                  {(item as unknown as Record<string, unknown>).useStatReq ? (
                    <> &middot; {allStatKeys.find((s) => s.key === ((item as unknown as Record<string, unknown>).useStatReq as { stat: string; min: number }).stat)?.label} ≥ {((item as unknown as Record<string, unknown>).useStatReq as { stat: string; min: number }).min}</>
                  ) : null}
                </span>
              )}

              {Object.keys(item.statBonuses as Record<string, number>).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(item.statBonuses as Record<string, number>).map(([key, val]) => (
                    <span key={key} className="rounded bg-void px-1.5 py-0.5 text-[10px] text-green-400">
                      {allStatKeys.find((s) => s.key === key)?.label || key}: {val > 0 ? `+${val}` : val}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => startEdit(item)}
                  className="text-[10px] text-lavender-400 hover:text-lavender-300"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
