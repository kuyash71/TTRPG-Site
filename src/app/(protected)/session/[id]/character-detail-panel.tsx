"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

interface EquippedItemInfo {
  name: string;
  slot: string;
  rarity: string;
}

interface InventoryItemInfo {
  id: string;
  name: string;
  description: string | null;
  category: string;
  equipmentSlot: string | null;
  rarity: string;
  statBonuses: Record<string, number>;
  gridWidth: number;
  gridHeight: number;
  posX: number;
  posY: number;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: string | null;
}

interface SpellInfo {
  id: string;
  slotIndex: number | null;
  spellDefinition: {
    id: string;
    name: string;
    description: string;
    manaCost: number;
    cooldown: number;
    range: number;
    targetType: string;
    requiredLevel: number;
  };
}

interface CharacterInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  className: string | null;
  raceName: string | null;
  level: number;
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
  stats: { name: string; baseValue: number; currentValue: number; maxValue: number | null; isPublic: boolean }[];
  equippedItems?: EquippedItemInfo[];
  inventoryItems?: InventoryItemInfo[];
  spells?: SpellInfo[];
}

interface Props {
  character: CharacterInfo;
  isGm: boolean;
  isOwn: boolean;
  manaLabel: string;
  onClose: () => void;
}

interface CustomFieldEntry {
  id: string;
  title: string;
  content: string;
  isPrivate: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  LEGENDARY: "text-yellow-400",
  EPIC: "text-purple-400",
  RARE: "text-blue-400",
  UNCOMMON: "text-green-400",
  COMMON: "text-zinc-300",
};

const RARITY_BORDER: Record<string, string> = {
  LEGENDARY: "border-yellow-500/40",
  EPIC: "border-purple-500/40",
  RARE: "border-blue-500/40",
  UNCOMMON: "border-green-500/40",
  COMMON: "border-border",
};

const TARGET_LABELS: Record<string, string> = {
  SELF: "Kendine",
  SINGLE: "Tekli",
  AOE: "Alan",
  LINE: "Çizgi",
};

function getCustomFields(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>,
  canSeeAll: boolean
): CustomFieldEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toEntries = (raw: unknown, isPrivate: boolean): CustomFieldEntry[] => {
    if (!Array.isArray(raw)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return raw.map((f: any) => ({
      id: String(f.id ?? ""),
      title: String(f.title ?? ""),
      content: String(f.content ?? ""),
      isPrivate,
    }));
  };
  return [
    ...toEntries(publicData?.customFields, false),
    ...(canSeeAll ? toEntries(privateData?.customFields, true) : []),
  ];
}

export function CharacterDetailPanel({ character, isGm, isOwn, manaLabel, onClose }: Props) {
  const router = useRouter();
  const canSeeAll = isGm || isOwn;

  // All stats are shown, but non-public ones display "XXX" for non-owners
  const allStats = character.stats;
  const resourceStats = allStats.filter((s) => s.maxValue !== null);
  const attributeStats = allStats.filter((s) => s.maxValue === null);

  const customFields: CustomFieldEntry[] = getCustomFields(character.publicData, character.privateData, canSeeAll);

  // GM stat editing
  const [editMode, setEditMode] = useState(false);
  const [statChanges, setStatChanges] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tabs for GM: stats | inventory | spells
  const [tab, setTab] = useState<"stats" | "inventory" | "spells">("stats");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  function handleStatDelta(statName: string, delta: number, maxValue: number | null) {
    const current = statChanges[statName] ?? character.stats.find((s) => s.name === statName)?.currentValue ?? 0;
    let newVal = current + delta;
    if (maxValue !== null) newVal = Math.min(newVal, maxValue);
    newVal = Math.max(0, newVal);
    setStatChanges((prev) => ({ ...prev, [statName]: newVal }));
  }

  async function saveStatChanges() {
    if (Object.keys(statChanges).length === 0) return;
    setSaving(true);

    const statsToUpdate = Object.entries(statChanges).map(([name, currentValue]) => ({
      name,
      currentValue,
    }));

    const res = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats: statsToUpdate }),
    });

    if (res.ok) {
      showToast("Kaydedildi");
      setStatChanges({});
      setEditMode(false);
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
    setSaving(false);
  }

  function getBarColor(statName: string): string {
    if (statName === "HP") return "bg-green-500";
    const manaNames = [manaLabel, "Mana", "mana", "MP"];
    if (manaNames.includes(statName)) return "bg-blue-500";
    return "bg-lavender-400";
  }

  const inventoryItems = character.inventoryItems ?? [];
  const spells = character.spells ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="heading-gothic text-sm font-semibold text-zinc-100">
            {character.name}
          </h3>
          <p className="text-xs text-zinc-500">
            {character.username}
            {isOwn && (
              <span className="ml-1 rounded bg-lavender-900/50 px-1 py-0.5 text-[9px] text-lavender-400">
                Senin
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300"
          title="Kapat"
        >
          &times;
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-2 rounded border border-lavender-800/50 bg-lavender-950/30 px-2 py-1 text-[10px] text-lavender-300">
          {toast}
        </div>
      )}

      {/* Temel bilgiler */}
      <div className="mb-3 flex flex-wrap gap-2">
        {character.raceName && (
          <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-300">
            {character.raceName}
          </span>
        )}
        {character.className && (
          <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-300">
            {character.className}
          </span>
        )}
        <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-400">
          Lv {character.level}
        </span>
      </div>

      {/* Tab bar (only if GM and has inventory/spells) */}
      {isGm && (inventoryItems.length > 0 || spells.length > 0) && (
        <div className="mb-3 flex gap-1 rounded bg-void p-0.5">
          {(["stats", "inventory", "spells"] as const).map((t) => {
            const hasContent = t === "stats" || (t === "inventory" && inventoryItems.length > 0) || (t === "spells" && spells.length > 0);
            if (!hasContent) return null;
            const labels = { stats: "Statlar", inventory: "Envanter", spells: "Büyüler" };
            const icons = { stats: "stats", inventory: "Inventory", spells: "Spellbook" };
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                  tab === t
                    ? "bg-surface text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon name={icons[t]} size={12} /> {labels[t]}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── STATS TAB ─── */}
      {tab === "stats" && (
        <>
          {/* Resources */}
          {resourceStats.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                  <Icon name="health" size={12} /> Kaynaklar
                </h4>
                {(isGm || isOwn) && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-0.5 text-[9px] text-lavender-400 hover:text-lavender-300"
                  >
                    <Icon name="Editpen" size={10} /> Düzenle
                  </button>
                )}
              </div>
              {resourceStats.map((stat) => {
                const hidden = !stat.isPublic && !canSeeAll;
                const currentVal = statChanges[stat.name] ?? stat.currentValue;
                const percentage = stat.maxValue
                  ? (currentVal / stat.maxValue) * 100
                  : 100;

                return (
                  <div key={stat.name}>
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                        {stat.name === "HP" && <Icon name="health" size={10} />}
                        {(stat.name === manaLabel || stat.name === "Mana" || stat.name === "MP") && <Icon name="mana" size={10} />}
                        {stat.name}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-300">
                        {hidden ? "XXX / XXX" : `${currentVal}/${stat.maxValue}`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-void">
                      <div
                        className={`h-full rounded-full transition-all ${hidden ? "bg-zinc-600" : getBarColor(stat.name)}`}
                        style={{ width: hidden ? "100%" : `${Math.max(0, Math.min(100, percentage))}%` }}
                      />
                    </div>
                    {/* GM/Owner quick edit controls */}
                    {editMode && !hidden && (
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          onClick={() => handleStatDelta(stat.name, -10, stat.maxValue)}
                          className="rounded bg-red-900/30 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-900/50"
                        >
                          -10
                        </button>
                        <button
                          onClick={() => handleStatDelta(stat.name, -5, stat.maxValue)}
                          className="rounded bg-red-900/30 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-900/50"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleStatDelta(stat.name, -1, stat.maxValue)}
                          className="rounded bg-red-900/30 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-900/50"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => handleStatDelta(stat.name, 1, stat.maxValue)}
                          className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400 hover:bg-green-900/50"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleStatDelta(stat.name, 5, stat.maxValue)}
                          className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400 hover:bg-green-900/50"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => handleStatDelta(stat.name, 10, stat.maxValue)}
                          className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400 hover:bg-green-900/50"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => {
                            if (stat.maxValue !== null) setStatChanges((p) => ({ ...p, [stat.name]: stat.maxValue! }));
                          }}
                          className="rounded bg-blue-900/30 px-1.5 py-0.5 text-[9px] text-blue-400 hover:bg-blue-900/50"
                          title="Full"
                        >
                          Max
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Save / Cancel buttons */}
          {editMode && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={saveStatChanges}
                disabled={saving || Object.keys(statChanges).length === 0}
                className="flex-1 rounded bg-lavender-400 py-1 text-[10px] font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
              >
                {saving ? "..." : "Kaydet"}
              </button>
              <button
                onClick={() => { setEditMode(false); setStatChanges({}); }}
                className="rounded border border-border px-3 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
              >
                İptal
              </button>
            </div>
          )}

          {/* Attributes */}
          {attributeStats.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-1 text-[10px] font-semibold text-zinc-500">Nitelikler</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {attributeStats.map((stat) => {
                  const hidden = !stat.isPublic && !canSeeAll;
                  return (
                    <div
                      key={stat.name}
                      className="flex items-center justify-between rounded border border-border bg-void px-2 py-1"
                    >
                      <span className="text-[10px] text-zinc-400">{stat.name}</span>
                      <span className="font-mono text-xs font-bold text-zinc-100">
                        {hidden ? "XXX" : stat.currentValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Backstory */}
          {canSeeAll && !!character.publicData?.backstory && (
            <div className="mb-4">
              <h4 className="mb-1 text-[10px] font-semibold text-zinc-500">Hikaye</h4>
              <p className="text-xs leading-relaxed text-zinc-400">
                {String(character.publicData.backstory)}
              </p>
            </div>
          )}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="mb-4 space-y-2">
              <h4 className="text-[10px] font-semibold text-zinc-500">Ek Bilgiler</h4>
              {customFields.map((field) => (
                <div key={field.id} className="rounded border border-border bg-void p-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-zinc-300">
                      {field.title || "Başlıksız"}
                    </span>
                    {field.isPrivate && (
                      <span className="rounded bg-red-900/30 px-1 py-0.5 text-[9px] text-red-400">
                        Gizli
                      </span>
                    )}
                  </div>
                  {field.content && (
                    <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
                      {field.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Equipped Items */}
          {character.equippedItems && character.equippedItems.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                <Icon name="Shield" size={12} /> Kuşanılmış
              </h4>
              <div className="space-y-1">
                {character.equippedItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded border border-border bg-void px-2 py-1"
                  >
                    <span className={`text-[10px] font-medium ${RARITY_COLOR[item.rarity] ?? "text-zinc-300"}`}>
                      {item.name}
                    </span>
                    <span className="text-[9px] text-zinc-600">{item.slot}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!canSeeAll && allStats.length === 0 && (
            <p className="py-4 text-center text-xs text-zinc-600">
              Bu karakter hakkında görüntülenecek bilgi yok.
            </p>
          )}
        </>
      )}

      {/* ─── INVENTORY TAB ─── */}
      {tab === "inventory" && isGm && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-zinc-500">
            Envanter ({inventoryItems.length} eşya)
          </h4>
          {inventoryItems.length === 0 ? (
            <p className="py-4 text-center text-[10px] text-zinc-600">Envanter boş.</p>
          ) : (
            <div className="space-y-1.5">
              {inventoryItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded border ${RARITY_BORDER[item.rarity] ?? "border-border"} bg-void p-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium ${RARITY_COLOR[item.rarity] ?? "text-zinc-300"}`}>
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="ml-1 text-zinc-500">x{item.quantity}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.isEquipped && (
                        <span className="rounded bg-lavender-900/50 px-1 py-0.5 text-[8px] text-lavender-400">
                          {item.equippedSlot ?? "Kuşanılmış"}
                        </span>
                      )}
                      <span className="text-[8px] text-zinc-600">{item.category}</span>
                    </div>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-[9px] text-zinc-500">{item.description}</p>
                  )}
                  {Object.keys(item.statBonuses).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(item.statBonuses).map(([key, val]) => (
                        <span
                          key={key}
                          className={`rounded px-1 py-0.5 text-[8px] ${val > 0 ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
                        >
                          {key}: {val > 0 ? "+" : ""}{val}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SPELLS TAB ─── */}
      {tab === "spells" && isGm && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-zinc-500">
            Büyüler ({spells.length})
          </h4>
          {spells.length === 0 ? (
            <p className="py-4 text-center text-[10px] text-zinc-600">Bilinen büyü yok.</p>
          ) : (
            <div className="space-y-1.5">
              {spells.map((cs) => (
                <div
                  key={cs.id}
                  className="rounded border border-blue-900/40 bg-blue-950/20 p-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-blue-300">
                      {cs.spellDefinition.name}
                    </span>
                    {cs.slotIndex !== null && (
                      <span className="rounded bg-blue-900/50 px-1 py-0.5 text-[8px] text-blue-400">
                        Slot {cs.slotIndex + 1}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[9px] text-zinc-500">
                    {cs.spellDefinition.description}
                  </p>
                  <div className="mt-1 flex gap-2 text-[8px] text-zinc-500">
                    <span>{cs.spellDefinition.manaCost} {manaLabel}</span>
                    <span>{TARGET_LABELS[cs.spellDefinition.targetType] ?? cs.spellDefinition.targetType}</span>
                    {cs.spellDefinition.cooldown > 0 && <span>{cs.spellDefinition.cooldown} tur</span>}
                    {cs.spellDefinition.range > 0 && <span>Menzil: {cs.spellDefinition.range}</span>}
                    <span>Lv {cs.spellDefinition.requiredLevel}+</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
