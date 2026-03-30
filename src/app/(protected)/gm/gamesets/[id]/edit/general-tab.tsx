"use client";

import { useState } from "react";
import {
  parseGamesetConfig,
  DEFAULT_REALISTIC_HP_STATES,
  type HpSystemType,
  type RealisticHpState,
} from "@/types/gameset-config";

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
    hpSystem: parsed.hpSystem as HpSystemType,
    realisticHpStates: parsed.realisticHpStates as RealisticHpState[],
    hitDieLevelsPerRoll: parsed.hitDieLevelsPerRoll,
    inventoryGridWidth: parsed.inventoryGridWidth,
    inventoryGridHeight: parsed.inventoryGridHeight,
    equipmentSlotsEnabled: parsed.equipmentSlotsEnabled,
    inventoryCapacityStat: parsed.inventoryCapacityStat ?? "",
    inventoryCapacityRowsPerPoint: parsed.inventoryCapacityRowsPerPoint,
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
      hpSystem: form.hpSystem,
      realisticHpStates: form.realisticHpStates,
      hitDieLevelsPerRoll: form.hitDieLevelsPerRoll,
      inventoryGridWidth: form.inventoryGridWidth,
      inventoryGridHeight: form.inventoryGridHeight,
      equipmentSlotsEnabled: form.equipmentSlotsEnabled,
      inventoryCapacityStat: form.inventoryCapacityStat.trim() || null,
      inventoryCapacityRowsPerPoint: form.inventoryCapacityRowsPerPoint,
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

      <hr className="border-border" />

      <h3 className="heading-gothic text-sm font-semibold text-zinc-300">
        Can Sistemi
      </h3>

      <div className="space-y-4">
        {/* HP System Type */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, hpSystem: "hit-die" }))}
            className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
              form.hpSystem === "hit-die"
                ? "border-gold-400 bg-gold-900/10"
                : "border-border bg-void hover:border-zinc-600"
            }`}
          >
            <span className="text-sm font-medium text-zinc-100">Hit-Die</span>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Sayısal HP. Karakter oluşturmada hit-die atılır, level atlayınca artar.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, hpSystem: "realistic" }))}
            className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
              form.hpSystem === "realistic"
                ? "border-gold-400 bg-gold-900/10"
                : "border-border bg-void hover:border-zinc-600"
            }`}
          >
            <span className="text-sm font-medium text-zinc-100">Realistic</span>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Kelime bazlı can durumu. GM oyun sırasında değiştirir.
            </p>
          </button>
        </div>

        {form.hpSystem === "hit-die" && (
          <div>
            <label className="mb-1 block text-sm text-zinc-400">
              Kaç Seviyede Bir Hit-Die Atılır
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.hitDieLevelsPerRoll}
              onChange={(e) => setForm((f) => ({ ...f, hitDieLevelsPerRoll: +e.target.value }))}
              className="w-32 rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Sınıfın hit-die değeri (d6, d8, d10 vb.) sınıf ayarlarından gelir.
            </p>
          </div>
        )}

        {form.hpSystem === "realistic" && (
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Can Durumları (yukarıdan aşağı: en iyiden en kötüye)
            </label>
            <div className="space-y-2">
              {form.realisticHpStates.map((state, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={state.label}
                    onChange={(e) => {
                      const next = [...form.realisticHpStates];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setForm((f) => ({ ...f, realisticHpStates: next }));
                    }}
                    className="flex-1 rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
                    placeholder="Durum adı"
                  />
                  <select
                    value={state.color}
                    onChange={(e) => {
                      const next = [...form.realisticHpStates];
                      next[idx] = { ...next[idx], color: e.target.value };
                      setForm((f) => ({ ...f, realisticHpStates: next }));
                    }}
                    className="rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100"
                  >
                    <option value="text-yellow-400">Altın</option>
                    <option value="text-green-400">Yeşil</option>
                    <option value="text-blue-400">Mavi</option>
                    <option value="text-orange-400">Turuncu</option>
                    <option value="text-red-400">Kırmızı</option>
                    <option value="text-zinc-400">Gri</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.realisticHpStates.filter((_, i) => i !== idx);
                      setForm((f) => ({ ...f, realisticHpStates: next }));
                    }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  realisticHpStates: [
                    ...f.realisticHpStates,
                    { label: "", color: "text-zinc-400" },
                  ],
                }))
              }
              className="mt-2 rounded bg-surface-raised px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              + Durum Ekle
            </button>
            {form.realisticHpStates.length === 0 && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, realisticHpStates: DEFAULT_REALISTIC_HP_STATES }))}
                className="ml-2 mt-2 rounded bg-surface-raised px-3 py-1 text-xs text-lavender-400 hover:text-lavender-300"
              >
                Varsayılanları Yükle
              </button>
            )}
          </div>
        )}
      </div>

      <hr className="border-border" />

      <h3 className="heading-gothic text-sm font-semibold text-zinc-300">
        Envanter Sistemi
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Grid Genişliği (sütun)</label>
          <input
            type="number" min={1} max={20}
            value={form.inventoryGridWidth}
            onChange={(e) => setForm((f) => ({ ...f, inventoryGridWidth: +e.target.value }))}
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Grid Yüksekliği (satır)</label>
          <input
            type="number" min={1} max={20}
            value={form.inventoryGridHeight}
            onChange={(e) => setForm((f) => ({ ...f, inventoryGridHeight: +e.target.value }))}
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Kapasite Statı (opsiyonel)</label>
          <input
            type="text"
            value={form.inventoryCapacityStat}
            onChange={(e) => setForm((f) => ({ ...f, inventoryCapacityStat: e.target.value }))}
            placeholder="Ör: Güç, Dayanıklılık"
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-lavender-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-zinc-500">Bu stat değerine göre ek satır eklenir.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Stat Başına Ek Satır</label>
          <input
            type="number" min={0} max={5} step={0.1}
            value={form.inventoryCapacityRowsPerPoint}
            onChange={(e) => setForm((f) => ({ ...f, inventoryCapacityRowsPerPoint: +e.target.value }))}
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-zinc-500">0 = stat bağlı kapasite yok.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="equipSlots"
          checked={form.equipmentSlotsEnabled}
          onChange={(e) => setForm((f) => ({ ...f, equipmentSlotsEnabled: e.target.checked }))}
          className="rounded border-border"
        />
        <label htmlFor="equipSlots" className="text-sm text-zinc-400">
          Ekipman slotları aktif
        </label>
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
