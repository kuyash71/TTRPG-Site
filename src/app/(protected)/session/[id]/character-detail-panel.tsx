"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { SkillTreeViewer } from "@/components/skill-tree/skill-tree-viewer";
import { InventoryPanel } from "@/components/inventory-panel";
import type { Socket } from "socket.io-client";
import type { RealisticHpState, HpSystemType } from "@/types/gameset-config";

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

interface SkillTreeNodeInfo {
  id: string;
  name: string;
  description: string;
  classId: string | null;
  posX: number;
  posY: number;
  maxLevel: number;
  costPerLevel: number;
  unlockLevel: number;
  prerequisites: string[];
  statBonusesPerLevel: Record<string, number>;
  effect: unknown;
  nodeType: string;
  spellDefinitionId: string | null;
}

interface CharacterInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  classId: string | null;
  className: string | null;
  raceName: string | null;
  level: number;
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
  stats: { name: string; baseValue: number; currentValue: number; maxValue: number | null; isPublic: boolean }[];
  skillUnlocks?: { nodeId: string; currentLevel: number }[];
  equippedItems?: EquippedItemInfo[];
  inventoryItems?: InventoryItemInfo[];
  spells?: SpellInfo[];
}

interface GamesetItemInfo {
  id: string;
  name: string;
  description: string | null;
  category: string;
  gridWidth: number;
  gridHeight: number;
  equipmentSlot: string | null;
  statBonuses: Record<string, number>;
  rarity: string;
}

interface Props {
  character: CharacterInfo;
  isGm: boolean;
  isOwn: boolean;
  manaLabel: string;
  hpSystem: HpSystemType;
  realisticHpStates: RealisticHpState[];
  skillTreeNodes: SkillTreeNodeInfo[];
  socket: Socket | null;
  gamesetId: string;
  inventoryGridWidth: number;
  inventoryGridHeight: number;
  equipmentSlotsEnabled: boolean;
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

export function CharacterDetailPanel({
  character,
  isGm,
  isOwn,
  manaLabel,
  hpSystem,
  realisticHpStates,
  skillTreeNodes,
  socket,
  gamesetId,
  inventoryGridWidth,
  inventoryGridHeight,
  equipmentSlotsEnabled,
  onClose,
}: Props) {
  const router = useRouter();
  const canSeeAll = isGm || isOwn;

  const allStats = character.stats;
  const resourceStats = allStats.filter((s) => s.maxValue !== null);
  const attributeStats = allStats.filter((s) => s.maxValue === null);

  const customFields: CustomFieldEntry[] = getCustomFields(character.publicData, character.privateData, canSeeAll);

  // GM stat editing
  const [editMode, setEditMode] = useState(false);
  const [statChanges, setStatChanges] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Realistic HP state for GM
  const [realisticHpValue, setRealisticHpValue] = useState<string>(() => {
    const hpStat = character.publicData?.realisticHpState;
    return typeof hpStat === "string" ? hpStat : realisticHpStates[0]?.label ?? "";
  });

  // Tabs: stats | skills | inventory | spells
  const [tab, setTab] = useState<"stats" | "skills" | "inventory" | "spells">("stats");
  const [skillViewMode, setSkillViewMode] = useState<"list" | "map">("list");

  // GM item giving
  const [gamesetItems, setGamesetItems] = useState<GamesetItemInfo[]>([]);
  const [showGiveItem, setShowGiveItem] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [givingItemId, setGivingItemId] = useState<string | null>(null);
  const [givingBusy, setGivingBusy] = useState(false);

  useEffect(() => {
    if (!isGm || !showGiveItem || gamesetItems.length > 0) return;
    fetch(`/api/gamesets/${gamesetId}/items`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setGamesetItems(data.items);
      });
  }, [isGm, showGiveItem, gamesetId, gamesetItems.length]);

  async function handleGiveItem() {
    if (!givingItemId || givingBusy) return;
    setGivingBusy(true);
    const res = await fetch(`/api/characters/${character.id}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemDefinitionId: givingItemId, quantity: 1 }),
    });
    if (res.ok) {
      showToast("Eşya verildi");
      setShowGiveItem(false);
      setGivingItemId(null);
      setItemSearch("");
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
    setGivingBusy(false);
  }

  // Reshape flat InventoryItemInfo → InventoryPanel format
  const inventoryPanelItems = useMemo(() => {
    return (character.inventoryItems ?? []).map((item) => ({
      id: item.id,
      itemDefinitionId: "",
      posX: item.posX,
      posY: item.posY,
      quantity: item.quantity,
      isEquipped: item.isEquipped,
      equippedSlot: item.equippedSlot,
      itemDefinition: {
        id: "",
        name: item.name,
        description: item.description,
        category: item.category,
        gridWidth: item.gridWidth,
        gridHeight: item.gridHeight,
        equipmentSlot: item.equipmentSlot,
        statBonuses: item.statBonuses,
        rarity: item.rarity,
        iconUrl: null,
      },
    }));
  }, [character.inventoryItems]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Skill tree data
  const unlockedMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of character.skillUnlocks ?? []) {
      map.set(u.nodeId, u.currentLevel);
    }
    return map;
  }, [character.skillUnlocks]);

  // Filter skill tree nodes for this character's class
  const characterClassNodes = useMemo(() => {
    return skillTreeNodes.filter((n) => !n.classId || n.classId === character.classId);
  }, [skillTreeNodes, character.classId]);

  const commonSkillNodes = useMemo(() => characterClassNodes.filter((n) => !n.classId), [characterClassNodes]);
  const classSkillNodes = useMemo(() => characterClassNodes.filter((n) => !!n.classId), [characterClassNodes]);

  // Only show unlocked skills
  const unlockedNodes = useMemo(() => {
    return characterClassNodes.filter((n) => unlockedMap.has(n.id));
  }, [characterClassNodes, unlockedMap]);

  const commonUnlockedNodes = useMemo(() => unlockedNodes.filter((n) => !n.classId), [unlockedNodes]);
  const classUnlockedNodes = useMemo(() => unlockedNodes.filter((n) => !!n.classId), [unlockedNodes]);

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
      // Broadcast stat change via socket
      if (socket) {
        socket.emit("character:update", {
          characterId: character.id,
          stats: statsToUpdate,
        });
      }
      setStatChanges({});
      setEditMode(false);
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
    setSaving(false);
  }

  async function updateRealisticHp(newState: string) {
    setRealisticHpValue(newState);
    const res = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicData: { ...character.publicData, realisticHpState: newState } }),
    });
    if (res.ok) {
      showToast("Sağlık durumu güncellendi");
      if (socket) {
        socket.emit("character:update", {
          characterId: character.id,
          stats: [{ name: "realisticHpState", currentValue: newState }],
        });
      }
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
  }

  function getBarColor(statName: string): string {
    if (statName === "HP") return "bg-green-500";
    const manaNames = [manaLabel, "Mana", "mana", "MP"];
    if (manaNames.includes(statName)) return "bg-blue-500";
    return "bg-lavender-400";
  }

  const inventoryItems = character.inventoryItems ?? [];
  const spells = character.spells ?? [];

  // Realistic HP display
  const currentRealisticState = realisticHpStates.find((s) => s.label === realisticHpValue);

  // Determine tabs to show
  const hasSkills = unlockedNodes.length > 0 || skillTreeNodes.length > 0;
  const tabItems = [
    { key: "stats" as const, label: "Statlar", icon: "stats" },
    ...(hasSkills ? [{ key: "skills" as const, label: "Kabiliyetler", icon: "scroll" }] : []),
    ...((inventoryItems.length > 0 || canSeeAll) ? [{ key: "inventory" as const, label: "Envanter", icon: "Inventory" }] : []),
    ...(spells.length > 0 ? [{ key: "spells" as const, label: "Büyüler", icon: "Spellbook" }] : []),
  ];

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

      {/* HP System Display */}
      {hpSystem === "realistic" && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
              <Icon name="health" size={12} /> Sağlık Durumu
            </span>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-colors ${
              currentRealisticState?.color ?? "text-zinc-400"
            } ${
              currentRealisticState?.color?.includes("yellow") ? "border-yellow-500/30 bg-yellow-950/20" :
              currentRealisticState?.color?.includes("green") ? "border-green-500/30 bg-green-950/20" :
              currentRealisticState?.color?.includes("orange") ? "border-orange-500/30 bg-orange-950/20" :
              currentRealisticState?.color?.includes("red") ? "border-red-500/30 bg-red-950/20" :
              currentRealisticState?.color?.includes("blue") ? "border-blue-500/30 bg-blue-950/20" :
              "border-border bg-void"
            }`}
          >
            {realisticHpValue || "—"}
          </div>
          {isGm && (
            <select
              value={realisticHpValue}
              onChange={(e) => updateRealisticHp(e.target.value)}
              className="mt-1.5 w-full rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100"
            >
              {realisticHpStates.map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Tab bar */}
      {tabItems.length > 1 && (
        <div className="mb-3 flex gap-1 rounded bg-void p-0.5">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                tab === t.key
                  ? "bg-surface text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon name={t.icon} size={12} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── STATS TAB ─── */}
      {tab === "stats" && (
        <>
          {/* Resources (HP/Mana) */}
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

                // For hit-die HP, skip if system is realistic
                if (stat.name === "HP" && hpSystem === "realistic") return null;

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

      {/* ─── SKILLS TAB ─── */}
      {tab === "skills" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
              <Icon name="scroll" size={12} /> Kabiliyetler
            </h4>
            <div className="flex overflow-hidden rounded border border-border">
              <button
                onClick={() => setSkillViewMode("list")}
                className={`px-2 py-0.5 text-[9px] font-medium ${
                  skillViewMode === "list"
                    ? "bg-gold-400 text-void"
                    : "bg-surface text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Liste
              </button>
              <button
                onClick={() => setSkillViewMode("map")}
                className={`px-2 py-0.5 text-[9px] font-medium ${
                  skillViewMode === "map"
                    ? "bg-gold-400 text-void"
                    : "bg-surface text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Harita
              </button>
            </div>
          </div>

          {skillViewMode === "list" ? (
            <div className="space-y-3">
              {unlockedNodes.length === 0 && (
                <p className="py-4 text-center text-[10px] text-zinc-600">
                  Açılmış kabiliyet yok.
                </p>
              )}
              {commonUnlockedNodes.length > 0 && (
                <div>
                  <h5 className="mb-1 border-b border-border pb-0.5 text-[9px] font-semibold text-zinc-400">
                    Ortak Ağaç
                  </h5>
                  <div className="space-y-1">
                    {commonUnlockedNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between rounded border border-gold-400/30 bg-gold-900/10 px-2 py-1"
                      >
                        <div>
                          <span className="text-[10px] font-medium text-zinc-100">{node.name}</span>
                          {node.description && (
                            <p className="text-[9px] text-zinc-500">{node.description}</p>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-gold-400">
                          Lv {unlockedMap.get(node.id) ?? 0}/{node.maxLevel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {classUnlockedNodes.length > 0 && (
                <div>
                  <h5 className="mb-1 border-b border-gold-900/30 pb-0.5 text-[9px] font-semibold text-gold-400">
                    Sınıf Ağacı
                  </h5>
                  <div className="space-y-1">
                    {classUnlockedNodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between rounded border border-lavender-400/30 bg-lavender-900/10 px-2 py-1"
                      >
                        <div>
                          <span className="text-[10px] font-medium text-zinc-100">{node.name}</span>
                          {node.description && (
                            <p className="text-[9px] text-zinc-500">{node.description}</p>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-lavender-400">
                          Lv {unlockedMap.get(node.id) ?? 0}/{node.maxLevel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {commonSkillNodes.length > 0 && (
                <div>
                  <h5 className="mb-1 text-[9px] font-semibold text-zinc-400">Ortak Ağaç</h5>
                  <div className="h-[250px] rounded-lg border border-border">
                    <SkillTreeViewer
                      nodes={commonSkillNodes as Parameters<typeof SkillTreeViewer>[0]["nodes"]}
                      unlockedMap={unlockedMap}
                      preventScrolling={false}
                    />
                  </div>
                </div>
              )}
              {classSkillNodes.length > 0 && (
                <div>
                  <h5 className="mb-1 text-[9px] font-semibold text-gold-400">Sınıf Ağacı</h5>
                  <div className="h-[250px] rounded-lg border border-border">
                    <SkillTreeViewer
                      nodes={classSkillNodes as Parameters<typeof SkillTreeViewer>[0]["nodes"]}
                      unlockedMap={unlockedMap}
                      preventScrolling={false}
                    />
                  </div>
                </div>
              )}
              {commonSkillNodes.length === 0 && classSkillNodes.length === 0 && (
                <p className="py-4 text-center text-[10px] text-zinc-600">
                  Skill ağacı tanımlanmamış.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── INVENTORY TAB ─── */}
      {tab === "inventory" && (
        <div className="space-y-3">
          {/* GM eşya verme */}
          {isGm && (
            <div>
              {!showGiveItem ? (
                <button
                  onClick={() => setShowGiveItem(true)}
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-gold-400/40 py-1.5 text-[10px] text-gold-400 hover:border-gold-400/70 hover:bg-gold-900/10"
                >
                  <Icon name="Editpen" size={11} /> Eşya Ver
                </button>
              ) : (
                <div className="rounded border border-gold-900/40 bg-gold-900/10 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gold-400">Eşya Ver</span>
                    <button onClick={() => { setShowGiveItem(false); setGivingItemId(null); setItemSearch(""); }} className="text-zinc-500 hover:text-zinc-300 text-xs">&times;</button>
                  </div>
                  <input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Eşya ara..."
                    className="mb-1.5 w-full rounded border border-border bg-void px-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-gold-400 focus:outline-none"
                  />
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {gamesetItems.length === 0 && (
                      <p className="text-center text-[9px] text-zinc-600 py-2">Yükleniyor...</p>
                    )}
                    {gamesetItems
                      .filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map((i) => (
                        <button
                          key={i.id}
                          onClick={() => setGivingItemId(i.id)}
                          className={`w-full rounded px-2 py-1 text-left text-[10px] transition-colors ${
                            givingItemId === i.id
                              ? "bg-gold-400/20 text-gold-300"
                              : "text-zinc-300 hover:bg-surface-raised"
                          }`}
                        >
                          {i.name}
                          <span className="ml-1 text-[9px] text-zinc-500">{i.category}</span>
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={handleGiveItem}
                    disabled={!givingItemId || givingBusy}
                    className="mt-1.5 w-full rounded bg-gold-400 py-1 text-[10px] font-medium text-void disabled:opacity-40"
                  >
                    {givingBusy ? "..." : "Ver"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tam grid envanter (owner veya GM) */}
          {canSeeAll ? (
            <div className="-mx-4 overflow-x-auto px-4">
              <InventoryPanel
                characterId={character.id}
                items={inventoryPanelItems}
                gridWidth={inventoryGridWidth}
                gridHeight={inventoryGridHeight}
                equipmentSlotsEnabled={equipmentSlotsEnabled}
                isOwner={isOwn}
                isGm={isGm}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              {inventoryItems.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-zinc-600">Envanter boş.</p>
              ) : (
                inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded border ${RARITY_BORDER[item.rarity] ?? "border-border"} bg-void p-2`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-medium ${RARITY_COLOR[item.rarity] ?? "text-zinc-300"}`}>
                        {item.name}
                        {item.quantity > 1 && <span className="ml-1 text-zinc-500">x{item.quantity}</span>}
                      </span>
                      <span className="text-[8px] text-zinc-600">{item.category}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── SPELLS TAB ─── */}
      {tab === "spells" && (
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
