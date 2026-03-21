"use client";

import { useState } from "react";
import { parseGamesetConfig } from "@/types/gameset-config";

interface Props {
  gamesetId: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  onUpdate: (updates: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => void;
}

export function GeneralTab({
  gamesetId,
  name,
  description,
  config,
  onUpdate,
}: Props) {
  const parsed = parseGamesetConfig(config);

  const [form, setForm] = useState({
    name,
    description,
    maxLevel: parsed.maxLevel,
    startingSkillPoints: parsed.startingSkillPoints,
    skillPointsPerLevel: parsed.skillPointsPerLevel,
    manaLabel: parsed.manaLabel,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const newConfig = {
      ...config,
      maxLevel: form.maxLevel,
      startingSkillPoints: form.startingSkillPoints,
      skillPointsPerLevel: form.skillPointsPerLevel,
      manaLabel: form.manaLabel,
    };

    const res = await fetch(`/api/gamesets/${gamesetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        config: newConfig,
      }),
    });

    if (res.ok) {
      setMessage("Kaydedildi.");
      onUpdate({
        name: form.name,
        description: form.description,
        config: newConfig,
      });
    } else {
      const data = await res.json();
      setMessage(data.error || "Hata oluştu.");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="heading-gothic text-lg font-semibold text-zinc-100">
        Genel Ayarlar
      </h2>

      {/* Name */}
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Gameset Adı</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm text-zinc-400">Açıklama</label>
        <textarea
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      <hr className="border-border" />

      <h3 className="heading-gothic text-sm font-semibold text-zinc-300">
        Oyun Kuralları
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Max Level */}
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Maksimum Seviye
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.maxLevel}
            onChange={(e) =>
              setForm((f) => ({ ...f, maxLevel: Number(e.target.value) }))
            }
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>

        {/* Starting Skill Points */}
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Başlangıç Skill Puanı
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.startingSkillPoints}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                startingSkillPoints: Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>

        {/* Skill Points Per Level */}
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Seviye Başı Skill Puanı
          </label>
          <input
            type="number"
            min={0}
            max={50}
            value={form.skillPointsPerLevel}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                skillPointsPerLevel: Number(e.target.value),
              }))
            }
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>

        {/* Mana Label */}
        <div>
          <label className="mb-1 block text-sm text-zinc-400">
            Mana Etiketi
          </label>
          <input
            type="text"
            value={form.manaLabel}
            onChange={(e) =>
              setForm((f) => ({ ...f, manaLabel: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gold-600 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-gold-500 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {message && (
          <span className="text-sm text-zinc-400">{message}</span>
        )}
      </div>
    </div>
  );
}
