"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { SkillTreeViewer } from "@/components/skill-tree/skill-tree-viewer";
import { InventoryPanel } from "@/components/inventory-panel";
import { LootPanel, type LootItem } from "@/components/loot-panel";
import type { Socket } from "socket.io-client";
import type { RealisticHpState, HpSystemType, CurrencyDef } from "@/types/gameset-config";

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
  skillPoints?: number;
  walletBalances: Record<string, number>;
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
  currencies: CurrencyDef[];
  otherCharacters?: { id: string; name: string; userId: string }[];
  lootItems?: LootItem[];
  onAddLoot?: () => void;
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
  currencies,
  otherCharacters = [],
  lootItems = [],
  onAddLoot,
  onClose,
}: Props) {
  const router = useRouter();
  const canSeeAll = isGm || isOwn;

  const allStats = character.stats;
  const resourceStats = allStats.filter((s) => s.maxValue !== null);
  const attributeStats = allStats.filter((s) => s.maxValue === null);

  const customFields: CustomFieldEntry[] = getCustomFields(character.publicData, character.privateData, canSeeAll);

  // GM/Owner stat editing
  const [editMode, setEditMode] = useState(false);
  const [statChanges, setStatChanges] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Level editing (GM only)
  const [levelSaving, setLevelSaving] = useState(false);

  // Optimistic overrides for level and skillPoints — give instant feedback
  // even if router.refresh() is slow or the server-component data is cached.
  // Cleared automatically when the parent pushes updated props for this character.
  const [levelOverride, setLevelOverride] = useState<number | null>(null);
  const [skillPointsOverride, setSkillPointsOverride] = useState<number | null>(null);
  useEffect(() => {
    setLevelOverride(null);
    setSkillPointsOverride(null);
  }, [character.id, character.level, character.skillPoints]);
  const displayLevel = levelOverride ?? character.level;
  const displaySkillPoints = skillPointsOverride ?? character.skillPoints ?? 0;

  // Notebook editing
  const initialPublicNotes = typeof character.publicData?.notebook === "string" ? (character.publicData.notebook as string) : "";
  const initialPrivateNotes = typeof character.privateData?.notebook === "string" ? (character.privateData.notebook as string) : "";
  const [publicNotesDraft, setPublicNotesDraft] = useState(initialPublicNotes);
  const [privateNotesDraft, setPrivateNotesDraft] = useState(initialPrivateNotes);
  const [publicNotesSaving, setPublicNotesSaving] = useState(false);
  const [privateNotesSaving, setPrivateNotesSaving] = useState(false);

  // Re-sync notebook drafts when character prop updates (e.g. after router.refresh)
  useEffect(() => {
    const pub = typeof character.publicData?.notebook === "string" ? (character.publicData.notebook as string) : "";
    setPublicNotesDraft(pub);
  }, [character.publicData]);
  useEffect(() => {
    const priv = typeof character.privateData?.notebook === "string" ? (character.privateData.notebook as string) : "";
    setPrivateNotesDraft(priv);
  }, [character.privateData]);

  // Realistic HP state for GM
  const [realisticHpValue, setRealisticHpValue] = useState<string>(() => {
    const hpStat = character.publicData?.realisticHpState;
    return typeof hpStat === "string" ? hpStat : realisticHpStates[0]?.label ?? "";
  });

  // Wallet
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>(character.walletBalances ?? {});
  const [walletEditing, setWalletEditing] = useState(false);
  const [walletDraft, setWalletDraft] = useState<Record<string, number>>({});
  const [walletSaving, setWalletSaving] = useState(false);

  // Re-sync local wallet when parent character prop updates (e.g. wallet:updated socket event)
  useEffect(() => {
    if (!walletEditing) {
      setWalletBalances(character.walletBalances ?? {});
    }
  }, [character.walletBalances, walletEditing]);

  // Money transfer
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferAmounts, setTransferAmounts] = useState<Record<string, number>>({});
  const [transferBusy, setTransferBusy] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<{ id: string; fromChar: { id: string; name: string }; toChar: { id: string; name: string }; amounts: Record<string, number>; status: string }[]>([]);

  // Listen for transfer events
  useEffect(() => {
    if (!socket) return;
    function handleTransferRequest(data: { id: string; fromChar: { id: string; name: string }; toChar: { id: string; name: string; user: { id: string } }; amounts: Record<string, number>; status: string }) {
      if (data.fromChar.id === character.id || data.toChar.id === character.id) {
        setPendingTransfers((prev) => [...prev, data]);
      }
    }
    function handleTransferResult(data: { transferId: string; status: string; fromCharId?: string; toCharId?: string; fromBalances?: Record<string, number>; toBalances?: Record<string, number> }) {
      setPendingTransfers((prev) => prev.filter((t) => t.id !== data.transferId));
      if (data.status === "ACCEPTED") {
        if (data.fromCharId === character.id && data.fromBalances) setWalletBalances(data.fromBalances);
        if (data.toCharId === character.id && data.toBalances) setWalletBalances(data.toBalances);
      }
    }
    socket.on("money:transfer_request", handleTransferRequest);
    socket.on("money:transfer_result", handleTransferResult);
    return () => {
      socket.off("money:transfer_request", handleTransferRequest);
      socket.off("money:transfer_result", handleTransferResult);
    };
  }, [socket, character.id]);

  // Tabs: stats | skills | inventory | spells | notes
  const [tab, setTab] = useState<"stats" | "skills" | "inventory" | "spells" | "notes">("stats");
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

  // Skill unlock (owner + GM)
  const [unlockingNodeId, setUnlockingNodeId] = useState<string | null>(null);

  async function handleUnlockSkill(nodeId: string) {
    if (!(isOwn || isGm) || unlockingNodeId) return;
    setUnlockingNodeId(nodeId);
    const res = await fetch(`/api/characters/${character.id}/skill-unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId }),
    });
    if (res.ok) {
      const data = await res.json();
      // Optimistically update skillPoints so the UI reflects spending immediately.
      setSkillPointsOverride(data.remainingPoints);
      showToast(`Seviye ${data.newLevel} · Kalan: ${data.remainingPoints}`);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({ error: "Hata oluştu" }));
      showToast(err.error ?? "Hata oluştu");
    }
    setUnlockingNodeId(null);
  }

  async function handleLevelChange(delta: number) {
    if (!isGm || levelSaving) return;
    if (delta === 0) return;
    setLevelSaving(true);

    if (delta > 0) {
      // Seviye artışı — level-up endpoint skillPoints de veriyor (config.skillPointsPerLevel)
      const res = await fetch(`/api/characters/${character.id}/level-up`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        // Optimistic local update — don't wait for router.refresh()
        setLevelOverride(data.newLevel);
        setSkillPointsOverride(data.skillPoints);
        showToast(`Seviye ${data.newLevel} · +${data.addedPoints} puan (toplam ${data.skillPoints})`);
        if (socket) {
          socket.emit("character:update", {
            characterId: character.id,
            stats: [{ name: "level", currentValue: data.newLevel }],
          });
        }
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({ error: "Hata oluştu" }));
        showToast(err.error ?? "Hata oluştu");
      }
    } else {
      // Seviye düşürme — PATCH ile sadece level. skillPoints'e dokunmuyoruz
      // çünkü oyuncu o puanları zaten harcamış olabilir.
      const nextLevel = Math.max(1, (levelOverride ?? character.level) + delta);
      if (nextLevel === (levelOverride ?? character.level)) {
        setLevelSaving(false);
        return;
      }
      const res = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: nextLevel }),
      });
      if (res.ok) {
        setLevelOverride(nextLevel);
        showToast(`Seviye ${nextLevel}`);
        if (socket) {
          socket.emit("character:update", {
            characterId: character.id,
            stats: [{ name: "level", currentValue: nextLevel }],
          });
        }
        router.refresh();
      } else {
        showToast("Hata oluştu");
      }
    }

    setLevelSaving(false);
  }

  async function savePublicNotes() {
    if (publicNotesSaving) return;
    setPublicNotesSaving(true);
    const res = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicData: { ...character.publicData, notebook: publicNotesDraft },
      }),
    });
    if (res.ok) {
      showToast("Not kaydedildi");
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
    setPublicNotesSaving(false);
  }

  async function savePrivateNotes() {
    if (privateNotesSaving) return;
    setPrivateNotesSaving(true);
    const res = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privateData: { ...character.privateData, notebook: privateNotesDraft },
      }),
    });
    if (res.ok) {
      showToast("Özel not kaydedildi");
      router.refresh();
    } else {
      showToast("Hata oluştu");
    }
    setPrivateNotesSaving(false);
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
    { key: "notes" as const, label: "Notlar", icon: "scroll" },
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
        {isGm ? (
          <div className="flex items-center gap-1 rounded bg-surface-raised px-2 py-1 text-xs text-zinc-300">
            <button
              onClick={() => handleLevelChange(-1)}
              disabled={levelSaving || displayLevel <= 1}
              className="rounded px-1 text-red-400 hover:bg-red-900/30 disabled:opacity-30"
              title="Seviye azalt"
            >
              −
            </button>
            <span className="min-w-[40px] text-center font-semibold">Lv {displayLevel}</span>
            <button
              onClick={() => handleLevelChange(1)}
              disabled={levelSaving}
              className="rounded px-1 text-green-400 hover:bg-green-900/30 disabled:opacity-30"
              title="Seviye artır"
            >
              +
            </button>
          </div>
        ) : (
          <span className="rounded bg-surface-raised px-2 py-1 text-xs text-zinc-400">
            Lv {displayLevel}
          </span>
        )}
        {displaySkillPoints > 0 && canSeeAll && (
          <span
            className="rounded bg-lavender-900/30 px-2 py-1 text-xs text-lavender-300"
            title="Harcanabilir yetenek puanı"
          >
            ✦ {displaySkillPoints} puan
          </span>
        )}
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

          {/* Attributes */}
          {attributeStats.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-[10px] font-semibold text-zinc-500">Nitelikler</h4>
                {(isGm || isOwn) && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-0.5 text-[9px] text-lavender-400 hover:text-lavender-300"
                  >
                    <Icon name="Editpen" size={10} /> Düzenle
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {attributeStats.map((stat) => {
                  const hidden = !stat.isPublic && !canSeeAll;
                  const currentVal = statChanges[stat.name] ?? stat.currentValue;
                  return (
                    <div
                      key={stat.name}
                      className="rounded border border-border bg-void px-2 py-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">{stat.name}</span>
                        <span className="font-mono text-xs font-bold text-zinc-100">
                          {hidden ? "XXX" : currentVal}
                        </span>
                      </div>
                      {editMode && !hidden && (
                        <div className="mt-1 flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleStatDelta(stat.name, -1, stat.maxValue)}
                            className="rounded bg-red-900/30 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-900/50"
                          >
                            −1
                          </button>
                          <button
                            onClick={() => handleStatDelta(stat.name, 1, stat.maxValue)}
                            className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400 hover:bg-green-900/50"
                          >
                            +1
                          </button>
                          {isGm && (
                            <>
                              <button
                                onClick={() => handleStatDelta(stat.name, -5, stat.maxValue)}
                                className="rounded bg-red-900/30 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-red-900/50"
                              >
                                −5
                              </button>
                              <button
                                onClick={() => handleStatDelta(stat.name, 5, stat.maxValue)}
                                className="rounded bg-green-900/30 px-1.5 py-0.5 text-[9px] text-green-400 hover:bg-green-900/50"
                              >
                                +5
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save / Cancel buttons — shared between resource + attribute edits */}
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
            (() => {
              const canEditSkills = isOwn || isGm;
              const availablePoints = displaySkillPoints;
              const renderNode = (node: typeof characterClassNodes[number], accent: "common" | "class") => {
                const currentNodeLevel = unlockedMap.get(node.id) ?? 0;
                const isUnlocked = currentNodeLevel > 0;
                const isMaxed = currentNodeLevel >= node.maxLevel;
                const meetsLevel = displayLevel >= node.unlockLevel;
                const meetsPrereqs = node.prerequisites.every((pid) => unlockedMap.has(pid));
                const canAfford = availablePoints >= node.costPerLevel;
                const canUnlock = canEditSkills && !isMaxed && meetsLevel && meetsPrereqs && canAfford;

                let blockReason: string | null = null;
                if (isMaxed) blockReason = "Maksimum";
                else if (!meetsLevel) blockReason = `Lv ${node.unlockLevel} gerekli`;
                else if (!meetsPrereqs) blockReason = "Ön koşul eksik";
                else if (!canAfford) blockReason = "Puan yetmiyor";

                const borderCls =
                  accent === "class"
                    ? isUnlocked ? "border-lavender-400/40 bg-lavender-900/10" : "border-border bg-void"
                    : isUnlocked ? "border-gold-400/40 bg-gold-900/10" : "border-border bg-void";
                const levelColor = accent === "class" ? "text-lavender-400" : "text-gold-400";

                return (
                  <div key={node.id} className={`rounded border ${borderCls} px-2 py-1.5`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-zinc-100">{node.name}</span>
                          {node.nodeType === "SPELL_UNLOCK" && (
                            <span className="rounded bg-blue-900/40 px-1 py-0.5 text-[8px] text-blue-300">Büyü</span>
                          )}
                        </div>
                        {node.description && (
                          <p className="mt-0.5 text-[9px] leading-tight text-zinc-500">{node.description}</p>
                        )}
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[8px] text-zinc-600">
                          <span>Maliyet: {node.costPerLevel}</span>
                          <span>Min Lv: {node.unlockLevel}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-mono text-[10px] ${levelColor}`}>
                          {currentNodeLevel}/{node.maxLevel}
                        </span>
                        {canEditSkills && !isMaxed && (
                          <button
                            onClick={() => handleUnlockSkill(node.id)}
                            disabled={!canUnlock || unlockingNodeId === node.id}
                            className="rounded bg-lavender-400 px-2 py-0.5 text-[9px] font-medium text-void hover:bg-lavender-500 disabled:bg-zinc-800 disabled:text-zinc-600"
                            title={blockReason ?? `-${node.costPerLevel} puan`}
                          >
                            {unlockingNodeId === node.id ? "..." : isUnlocked ? "+1" : "Aç"}
                          </button>
                        )}
                        {isMaxed && (
                          <span className="rounded bg-green-900/30 px-1.5 py-0.5 text-[8px] text-green-400">Maks.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-3">
                  {canEditSkills && (
                    <div className="flex items-center justify-between rounded border border-lavender-400/30 bg-lavender-900/10 px-2 py-1">
                      <span className="text-[10px] text-zinc-400">Harcanabilir puan</span>
                      <span className="font-mono text-[11px] font-semibold text-lavender-300">
                        ✦ {availablePoints}
                      </span>
                    </div>
                  )}
                  {characterClassNodes.length === 0 && (
                    <p className="py-4 text-center text-[10px] text-zinc-600">
                      Skill ağacı tanımlanmamış.
                    </p>
                  )}
                  {commonSkillNodes.length > 0 && (
                    <div>
                      <h5 className="mb-1 border-b border-border pb-0.5 text-[9px] font-semibold text-zinc-400">
                        Ortak Ağaç
                      </h5>
                      <div className="space-y-1">
                        {commonSkillNodes.map((node) => renderNode(node, "common"))}
                      </div>
                    </div>
                  )}
                  {classSkillNodes.length > 0 && (
                    <div>
                      <h5 className="mb-1 border-b border-lavender-900/30 pb-0.5 text-[9px] font-semibold text-lavender-400">
                        Sınıf Ağacı
                      </h5>
                      <div className="space-y-1">
                        {classSkillNodes.map((node) => renderNode(node, "class"))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="space-y-3">
              {(isOwn || isGm) && (
                <div className="flex items-center justify-between rounded border border-lavender-400/30 bg-lavender-900/10 px-2 py-1">
                  <span className="text-[10px] text-zinc-400">
                    Harcanabilir puan — node&apos;a tıklayıp puan harcayabilirsin
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-lavender-300">
                    ✦ {displaySkillPoints}
                  </span>
                </div>
              )}
              {commonSkillNodes.length > 0 && (
                <div>
                  <h5 className="mb-1 text-[9px] font-semibold text-zinc-400">Ortak Ağaç</h5>
                  <div className="h-[250px] rounded-lg border border-border">
                    <SkillTreeViewer
                      nodes={commonSkillNodes as Parameters<typeof SkillTreeViewer>[0]["nodes"]}
                      unlockedMap={unlockedMap}
                      onNodeClick={(isOwn || isGm) ? handleUnlockSkill : undefined}
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
                      onNodeClick={(isOwn || isGm) ? handleUnlockSkill : undefined}
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
          {/* Para (Cüzdan) */}
          {canSeeAll && currencies.length > 0 && (
            <div className="rounded border border-border bg-void p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-zinc-400">Para</h4>
                {(isGm || isOwn) && !walletEditing && (
                  <button
                    onClick={() => { setWalletEditing(true); setWalletDraft({ ...walletBalances }); }}
                    className="text-[10px] text-lavender-400 hover:text-lavender-300"
                  >
                    Düzenle
                  </button>
                )}
              </div>
              {!walletEditing ? (
                <div className="flex flex-wrap gap-3">
                  {currencies.map((cur) => (
                    <div key={cur.code} className="flex items-center gap-1">
                      <span className="text-sm">{cur.symbol}</span>
                      <span className="font-mono text-sm font-bold text-zinc-100">{walletBalances[cur.code] ?? 0}</span>
                      <span className="text-[10px] text-zinc-500">{cur.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {currencies.map((cur) => (
                      <div key={cur.code} className="flex items-center gap-1">
                        <span className="text-sm">{cur.symbol}</span>
                        <input
                          type="number"
                          min={0}
                          value={walletDraft[cur.code] ?? 0}
                          onChange={(e) => setWalletDraft((prev) => ({ ...prev, [cur.code]: +e.target.value }))}
                          className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={walletSaving}
                      onClick={async () => {
                        setWalletSaving(true);
                        const res = await fetch(`/api/characters/${character.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ wallet: walletDraft }),
                        });
                        if (res.ok) {
                          setWalletBalances(walletDraft);
                          setWalletEditing(false);
                          if (socket) socket.emit("wallet:update", { characterId: character.id, balances: walletDraft });
                        }
                        setWalletSaving(false);
                      }}
                      className="rounded bg-gold-400 px-3 py-1 text-[10px] font-medium text-void disabled:opacity-40"
                    >
                      {walletSaving ? "..." : "Kaydet"}
                    </button>
                    <button
                      onClick={() => setWalletEditing(false)}
                      className="rounded bg-surface-raised px-3 py-1 text-[10px] text-zinc-400 hover:text-zinc-200"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gelen transfer istekleri */}
          {pendingTransfers.filter((t) => t.toChar.id === character.id && t.status === "PENDING").map((t) => (
            <div key={t.id} className="rounded border border-lavender-400/30 bg-lavender-900/10 p-2">
              <p className="mb-1 text-[10px] text-lavender-400">
                <span className="font-semibold">{t.fromChar.name}</span> sana para göndermek istiyor:
              </p>
              <div className="mb-1.5 flex flex-wrap gap-2">
                {Object.entries(t.amounts).filter(([, v]) => v > 0).map(([code, val]) => {
                  const cur = currencies.find((c) => c.code === code);
                  return <span key={code} className="text-[10px] font-mono text-zinc-200">{cur?.symbol} {val}</span>;
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => socket?.emit("money:accept_transfer", { transferId: t.id })}
                  className="rounded bg-green-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-green-500"
                >
                  Kabul Et
                </button>
                <button
                  onClick={() => socket?.emit("money:reject_transfer", { transferId: t.id })}
                  className="rounded bg-red-600/80 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-500"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}

          {/* Gönderilen bekleyen transferler */}
          {pendingTransfers.filter((t) => t.fromChar.id === character.id && t.status === "PENDING").map((t) => (
            <div key={t.id} className="rounded border border-gold-400/20 bg-gold-900/10 p-2">
              <p className="text-[10px] text-gold-400">
                <span className="font-semibold">{t.toChar.name}</span>&apos;a transfer bekleniyor...
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(t.amounts).filter(([, v]) => v > 0).map(([code, val]) => {
                  const cur = currencies.find((c) => c.code === code);
                  return <span key={code} className="text-[10px] font-mono text-zinc-500">{cur?.symbol} {val}</span>;
                })}
              </div>
            </div>
          ))}

          {/* Para Gönder (kendi karakteri ise) */}
          {isOwn && otherCharacters.length > 0 && currencies.length > 0 && (
            <div>
              {!showTransfer ? (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-lavender-400/40 py-1.5 text-[10px] text-lavender-400 hover:border-lavender-400/70 hover:bg-lavender-900/10"
                >
                  Para Gönder
                </button>
              ) : (
                <div className="rounded border border-lavender-900/40 bg-lavender-900/10 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-lavender-400">Para Gönder</span>
                    <button onClick={() => { setShowTransfer(false); setTransferTarget(""); setTransferAmounts({}); }} className="text-zinc-500 hover:text-zinc-300 text-xs">&times;</button>
                  </div>
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="w-full rounded border border-border bg-void px-2 py-1 text-[10px] text-zinc-200"
                  >
                    <option value="">Karakter seç...</option>
                    {otherCharacters.filter((c) => c.id !== character.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {currencies.map((cur) => (
                      <div key={cur.code} className="flex items-center gap-1">
                        <span className="text-sm">{cur.symbol}</span>
                        <input
                          type="number"
                          min={0}
                          max={walletBalances[cur.code] ?? 0}
                          value={transferAmounts[cur.code] ?? 0}
                          onChange={(e) => setTransferAmounts((prev) => ({ ...prev, [cur.code]: +e.target.value }))}
                          className="w-16 rounded border border-border bg-void px-2 py-1 text-[10px] text-zinc-100 focus:border-lavender-400 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={!transferTarget || transferBusy || Object.values(transferAmounts).every((v) => !v)}
                    onClick={() => {
                      if (!socket || !transferTarget) return;
                      setTransferBusy(true);
                      const clean: Record<string, number> = {};
                      for (const [k, v] of Object.entries(transferAmounts)) {
                        if (v > 0) clean[k] = v;
                      }
                      socket.emit("money:send_request", { fromCharId: character.id, toCharId: transferTarget, amounts: clean });
                      setTransferBusy(false);
                      setShowTransfer(false);
                      setTransferTarget("");
                      setTransferAmounts({});
                    }}
                    className="w-full rounded bg-lavender-400 py-1 text-[10px] font-medium text-void disabled:opacity-40"
                  >
                    {transferBusy ? "..." : "Gönder"}
                  </button>
                </div>
              )}
            </div>
          )}

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
          ) : null}

          {/* Loot Havuzu — tüm karakterin sahibi ve GM görebilir */}
          {canSeeAll && (
            <div className="mt-4 border-t border-border pt-3">
              <LootPanel
                lootItems={lootItems}
                characterId={isOwn ? character.id : null}
                sessionId={gamesetId}
                gamesetId={gamesetId}
                isGm={isGm}
                socket={socket}
                onAddLoot={onAddLoot}
              />
            </div>
          )}

          {!canSeeAll && !isOwn && (
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

      {/* ─── NOTES TAB ─── */}
      {tab === "notes" && (
        <div className="space-y-4">
          {/* Public notes — everyone can read, owner + GM can edit */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                <Icon name="scroll" size={12} /> Herkese Açık Not
              </h4>
              {canSeeAll && publicNotesDraft !== initialPublicNotes && (
                <button
                  onClick={savePublicNotes}
                  disabled={publicNotesSaving}
                  className="rounded bg-lavender-400 px-2 py-0.5 text-[9px] font-medium text-void hover:bg-lavender-500 disabled:opacity-50"
                >
                  {publicNotesSaving ? "..." : "Kaydet"}
                </button>
              )}
            </div>
            {canSeeAll ? (
              <textarea
                value={publicNotesDraft}
                onChange={(e) => setPublicNotesDraft(e.target.value)}
                placeholder="Herkesin görebileceği notlar... (örn. karakter özellikleri, açık geçmiş)"
                rows={6}
                className="w-full resize-y rounded border border-border bg-void px-2 py-1.5 text-[11px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-lavender-400 focus:outline-none"
              />
            ) : publicNotesDraft ? (
              <div className="whitespace-pre-wrap rounded border border-border bg-void px-2 py-1.5 text-[11px] leading-relaxed text-zinc-300">
                {publicNotesDraft}
              </div>
            ) : (
              <p className="py-2 text-center text-[10px] text-zinc-600">Henüz açık not yok.</p>
            )}
          </div>

          {/* Private notes — owner + GM only */}
          {canSeeAll && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <h4 className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                  <Icon name="scroll" size={12} /> Özel Not
                  <span className="rounded bg-red-900/30 px-1 py-0.5 text-[8px] text-red-400">
                    {isOwn ? "Sen + GM" : "Karakter sahibi + GM"}
                  </span>
                </h4>
                {privateNotesDraft !== initialPrivateNotes && (
                  <button
                    onClick={savePrivateNotes}
                    disabled={privateNotesSaving}
                    className="rounded bg-lavender-400 px-2 py-0.5 text-[9px] font-medium text-void hover:bg-lavender-500 disabled:opacity-50"
                  >
                    {privateNotesSaving ? "..." : "Kaydet"}
                  </button>
                )}
              </div>
              <textarea
                value={privateNotesDraft}
                onChange={(e) => setPrivateNotesDraft(e.target.value)}
                placeholder="Sadece sen ve GM'in görebileceği notlar... (örn. gizli motivasyonlar, GM ile paylaşılan bilgiler)"
                rows={6}
                className="w-full resize-y rounded border border-red-900/40 bg-red-950/10 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-200 placeholder-zinc-600 focus:border-red-500/60 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
