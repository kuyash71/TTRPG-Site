"use client";

import { useState } from "react";
import type { SpellDefinitionData } from "./gameset-editor";

const TARGET_TYPES = [
  { value: "SELF", label: "Kendine" },
  { value: "SINGLE", label: "Tekli" },
  { value: "AOE", label: "Alan" },
  { value: "LINE", label: "Çizgi" },
] as const;

interface Props {
  gamesetId: string;
  spells: SpellDefinitionData[];
  onUpdate: (spells: SpellDefinitionData[]) => void;
}

const emptyForm = {
  name: "",
  description: "",
  manaCost: 0,
  cooldown: 0,
  range: 0,
  targetType: "SINGLE" as string,
  effects: "[]",
  iconUrl: "",
  requiredLevel: 1,
};

export function SpellsTab({ gamesetId, spells, onUpdate }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    let parsedEffects: unknown[] = [];
    try {
      parsedEffects = JSON.parse(form.effects);
    } catch {
      parsedEffects = [];
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      manaCost: form.manaCost,
      cooldown: form.cooldown,
      range: form.range,
      targetType: form.targetType,
      effects: parsedEffects,
      iconUrl: form.iconUrl.trim() || null,
      requiredLevel: form.requiredLevel,
    };

    if (editingId) {
      const res = await fetch(`/api/gamesets/${gamesetId}/spells/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(spells.map((s) => (s.id === editingId ? updated : s)));
      }
    } else {
      const res = await fetch(`/api/gamesets/${gamesetId}/spells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        onUpdate([...spells, created]);
      }
    }

    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/gamesets/${gamesetId}/spells/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onUpdate(spells.filter((s) => s.id !== id));
      if (editingId === id) {
        setForm(emptyForm);
        setEditingId(null);
      }
    }
  }

  function startEdit(spell: SpellDefinitionData) {
    setEditingId(spell.id);
    setForm({
      name: spell.name,
      description: spell.description,
      manaCost: spell.manaCost,
      cooldown: spell.cooldown,
      range: spell.range,
      targetType: spell.targetType,
      effects: JSON.stringify(spell.effects, null, 2),
      iconUrl: spell.iconUrl || "",
      requiredLevel: spell.requiredLevel,
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="heading-gothic text-lg font-semibold text-zinc-100">
        Büyü Tanımları
      </h2>

      {/* Form */}
      <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">
          {editingId ? "Büyüyü Düzenle" : "Yeni Büyü"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Ad</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
              placeholder="Ateş Topu"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Hedef Tipi</label>
            <select
              value={form.targetType}
              onChange={(e) => setForm({ ...form, targetType: e.target.value })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Açıklama</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Mana Maliyeti</label>
            <input
              type="number"
              min={0}
              value={form.manaCost}
              onChange={(e) => setForm({ ...form, manaCost: parseInt(e.target.value) || 0 })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Bekleme (tur)</label>
            <input
              type="number"
              min={0}
              value={form.cooldown}
              onChange={(e) => setForm({ ...form, cooldown: parseInt(e.target.value) || 0 })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Menzil</label>
            <input
              type="number"
              min={0}
              value={form.range}
              onChange={(e) => setForm({ ...form, range: parseInt(e.target.value) || 0 })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Gereken Seviye</label>
            <input
              type="number"
              min={1}
              value={form.requiredLevel}
              onChange={(e) => setForm({ ...form, requiredLevel: parseInt(e.target.value) || 1 })}
              className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Efektler (JSON)</label>
          <textarea
            value={form.effects}
            onChange={(e) => setForm({ ...form, effects: e.target.value })}
            className="w-full rounded border border-border bg-void px-3 py-1.5 font-mono text-xs text-zinc-200"
            rows={3}
            placeholder='[{"type": "damage", "value": 20}]'
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] text-zinc-500">Simge URL (opsiyonel)</label>
          <input
            value={form.iconUrl}
            onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
            className="w-full rounded border border-border bg-void px-3 py-1.5 text-sm text-zinc-200"
            placeholder="https://..."
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="rounded bg-lavender-400 px-4 py-1.5 text-sm font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
              }}
              className="rounded bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
            >
              İptal
            </button>
          )}
        </div>
      </div>

      {/* Spell List */}
      {spells.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          Henüz büyü tanımlanmadı.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {spells.map((spell) => (
            <div
              key={spell.id}
              className="rounded-lg border border-blue-900/50 bg-blue-950/20 p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-300">
                    {spell.name}
                  </h4>
                  {spell.description && (
                    <p className="mt-0.5 text-xs text-zinc-400 line-clamp-2">
                      {spell.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(spell)}
                    className="rounded px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDelete(spell.id)}
                    className="rounded px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-900/30"
                  >
                    Sil
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-blue-300">
                  Mana: {spell.manaCost}
                </span>
                {spell.cooldown > 0 && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                    Bekleme: {spell.cooldown} tur
                  </span>
                )}
                {spell.range > 0 && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                    Menzil: {spell.range}
                  </span>
                )}
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                  {TARGET_TYPES.find((t) => t.value === spell.targetType)?.label ?? spell.targetType}
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
                  Lv {spell.requiredLevel}+
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
