"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";
import { ChatPanel } from "./chat-panel";
import { CombatLogPanel } from "./combat-log-panel";
import { DicePanel } from "./dice-panel";
import { PlayerList } from "./player-list";
import { ApprovalPanel } from "./approval-panel";
import { CharacterDetailPanel } from "./character-detail-panel";
import { StoreManager, type StoreData } from "@/components/store-manager";
import { StorePanel } from "@/components/store-panel";
import { type LootItem } from "@/components/loot-panel";
import Link from "next/link";
import { useLocale, TranslationKey } from "@/lib/locale";
import { Icon } from "@/components/icon";
import type { RealisticHpState, HpSystemType, CurrencyDef } from "@/types/gameset-config";

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
  classId: string | null;
  className: string | null;
  raceName: string | null;
  level: number;
  walletBalances: Record<string, number>;
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
  stats: { name: string; baseValue: number; currentValue: number; maxValue: number | null; isPublic: boolean }[];
  skillUnlocks?: { nodeId: string; currentLevel: number }[];
  equippedItems?: { name: string; slot: string; rarity: string }[];
  inventoryItems?: InventoryItemInfo[];
  spells?: SpellInfo[];
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

interface Props {
  sessionId: string;
  sessionName: string;
  gamesetName: string;
  gamesetId: string;
  status: string;
  inviteCode: string;
  gm: { id: string; username: string };
  players: { id: string; username: string }[];
  characters: CharacterInfo[];
  skillTreeNodes: SkillTreeNodeInfo[];
  hpSystem: HpSystemType;
  realisticHpStates: RealisticHpState[];
  manaLabel: string;
  inventoryGridWidth: number;
  inventoryGridHeight: number;
  equipmentSlotsEnabled: boolean;
  inventoryCapacityStat: string | null;
  inventoryCapacityRowsPerPoint: number;
  currencies: CurrencyDef[];
  currentUser: { id: string; username: string; isGm: boolean };
  hasCharacter: boolean;
  pendingApproval: boolean;
  initialLootItems: LootItem[];
  initialStores: StoreData[];
}

const STATUS_KEYS: Record<string, { label: TranslationKey; color: string }> = {
  OPEN: { label: "session.statusOpen", color: "text-green-400" },
  ACTIVE: { label: "session.statusActive", color: "text-lavender-400" },
  CLOSED: { label: "session.statusClosed", color: "text-zinc-500" },
};

export function SessionRoom({
  sessionId,
  sessionName,
  gamesetName,
  gamesetId,
  status,
  inviteCode,
  gm,
  players,
  characters: charactersProp,
  skillTreeNodes,
  hpSystem,
  realisticHpStates,
  manaLabel,
  inventoryGridWidth,
  inventoryGridHeight,
  equipmentSlotsEnabled,
  inventoryCapacityStat,
  inventoryCapacityRowsPerPoint,
  currencies,
  currentUser,
  hasCharacter,
  pendingApproval,
  initialLootItems,
  initialStores,
}: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const { socket, connected } = useSocket(sessionId);

  // Local mutable state for characters so wallet/inventory updates re-render
  const [characters, setCharacters] = useState<CharacterInfo[]>(charactersProp);

  // Re-sync when prop changes (e.g. after router.refresh())
  useEffect(() => {
    setCharacters(charactersProp);
  }, [charactersProp]);
  const [mobileTab, setMobileTab] = useState<"chat" | "combatLog" | "players" | "dice" | "character" | "myChar">("chat");
  const [centerChatTab, setCenterChatTab] = useState<"chat" | "combatLog">("chat");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [detailViewUserId, setDetailViewUserId] = useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(pendingApproval);
  const [hasChar, setHasChar] = useState(hasCharacter);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Loot & Store state
  const [lootItems, setLootItems] = useState<LootItem[]>(initialLootItems);
  const [stores, setStores] = useState<StoreData[]>(initialStores);
  const [activeStore, setActiveStore] = useState<StoreData | null>(initialStores.find((s) => s.isActive) ?? null);
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [showStorePanel, setShowStorePanel] = useState(false);
  const [myOfferResults, setMyOfferResults] = useState<Record<string, { status: "APPROVED" | "REJECTED" | "ERROR"; message?: string }>>({});
  const [showLootAdd, setShowLootAdd] = useState(false);
  const [lootAddSearch, setLootAddSearch] = useState("");
  const [lootGamesetItems, setLootGamesetItems] = useState<{ id: string; name: string; category: string; rarity: string }[]>([]);
  const [lootAddBusy, setLootAddBusy] = useState(false);

  // Socket: onay/red bildirimleri
  useEffect(() => {
    if (!socket) return;

    function handleApproved({ playerId }: { playerId: string }) {
      if (playerId === currentUser.id) {
        setIsPendingApproval(false);
        setHasChar(true);
        setRejectionReason(null);
      }
      // Refresh for everyone so new character appears in player list
      router.refresh();
    }

    function handleRejected({ playerId, reason }: { playerId: string; reason?: string }) {
      if (playerId === currentUser.id) {
        setIsPendingApproval(false);
        setRejectionReason(reason || "Karakter isteğiniz reddedildi.");
      }
    }

    socket.on("session:character_approved", handleApproved);
    socket.on("char:approval_rejected", handleRejected);

    // Loot events
    function handleLootUpdated({ action, lootItem, lootId }: {
      action: "add" | "remove" | "update";
      lootItem?: LootItem;
      lootId?: string;
    }) {
      if (action === "add" && lootItem) {
        setLootItems((prev) => [...prev, lootItem]);
      } else if (action === "remove" && lootId) {
        setLootItems((prev) => prev.filter((i) => i.id !== lootId));
      } else if (action === "update" && lootItem) {
        setLootItems((prev) => prev.map((i) => i.id === lootItem.id ? lootItem : i));
      }
    }
    socket.on("loot:pool_updated", handleLootUpdated);

    // Store events
    function handleStoreActivated({ store }: { store: StoreData }) {
      setActiveStore(store);
      setStores((prev) => prev.map((s) => s.id === store.id ? store : s.isActive ? { ...s, isActive: false } : s));
      if (!currentUser.isGm) setShowStorePanel(true);
    }
    function handleStoreDeactivated({ storeId }: { storeId: string }) {
      setActiveStore(null);
      setStores((prev) => prev.map((s) => s.id === storeId ? { ...s, isActive: false } : s));
      setShowStorePanel(false);
    }
    function handleOfferResult({ txId, status, characterId: cid, message }: { txId: string; status: "APPROVED" | "REJECTED" | "ERROR"; characterId: string; message?: string }) {
      // Track result against my character for the toast/result panel
      setCharacters((prev) => {
        const myChar = prev.find((c) => c.userId === currentUser.id);
        if (cid === myChar?.id) {
          setMyOfferResults((r) => ({ ...r, [txId]: { status, message } }));
        }
        return prev;
      });
    }
    socket.on("store:activated", handleStoreActivated);
    socket.on("store:deactivated", handleStoreDeactivated);
    socket.on("store:offer_result", handleOfferResult);

    // Wallet updates — functional setState so we always update the latest state
    function handleWalletUpdated({ characterId, balances }: { characterId: string; balances: Record<string, number> }) {
      setCharacters((prev) =>
        prev.map((c) => (c.id === characterId ? { ...c, walletBalances: balances } : c))
      );
    }
    socket.on("wallet:updated", handleWalletUpdated);

    // Inventory item added (from store purchase, GM gift, etc.)
    function handleItemAdded({ characterId, item }: { characterId: string; item: { id: string; posX: number; posY: number; quantity: number; isEquipped?: boolean; equippedSlot?: string | null; itemDefinition: { name: string; description: string | null; category: string; equipmentSlot: string | null; rarity: string; statBonuses: unknown; gridWidth: number; gridHeight: number } } }) {
      if (!item || !item.itemDefinition) return;
      setCharacters((prev) =>
        prev.map((c) => {
          if (c.id !== characterId) return c;
          // Skip if item already in inventory (e.g. local optimistic update)
          if ((c.inventoryItems ?? []).some((i) => i.id === item.id)) return c;
          const newInvItem: InventoryItemInfo = {
            id: item.id,
            name: item.itemDefinition.name,
            description: item.itemDefinition.description,
            category: item.itemDefinition.category,
            equipmentSlot: item.itemDefinition.equipmentSlot,
            rarity: item.itemDefinition.rarity,
            statBonuses: (item.itemDefinition.statBonuses as Record<string, number>) ?? {},
            gridWidth: item.itemDefinition.gridWidth,
            gridHeight: item.itemDefinition.gridHeight,
            posX: item.posX,
            posY: item.posY,
            quantity: item.quantity,
            isEquipped: item.isEquipped ?? false,
            equippedSlot: item.equippedSlot ?? null,
          };
          return { ...c, inventoryItems: [...(c.inventoryItems ?? []), newInvItem] };
        })
      );
    }
    socket.on("inv:item_added", handleItemAdded);

    return () => {
      socket.off("session:character_approved", handleApproved);
      socket.off("char:approval_rejected", handleRejected);
      socket.off("loot:pool_updated", handleLootUpdated);
      socket.off("store:activated", handleStoreActivated);
      socket.off("store:deactivated", handleStoreDeactivated);
      socket.off("store:offer_result", handleOfferResult);
      socket.off("wallet:updated", handleWalletUpdated);
      socket.off("inv:item_added", handleItemAdded);
    };
  }, [socket, currentUser.id, currentUser.isGm, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // GM: Loot'a eşya ekle
  async function handleAddToLoot(itemDefinitionId: string) {
    if (lootAddBusy || !socket) return;
    setLootAddBusy(true);
    socket.emit("loot:add", { itemDefinitionId, quantity: 1 });
    setLootAddSearch("");
    setShowLootAdd(false);
    setLootAddBusy(false);
  }

  async function loadLootGamesetItems() {
    if (lootGamesetItems.length > 0) return;
    const res = await fetch(`/api/gamesets/${gamesetId}/items`);
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.items)) setLootGamesetItems(d.items);
    }
  }

  const selectedCharacter = selectedPlayerId
    ? characters.find((c) => c.userId === selectedPlayerId) ?? null
    : null;

  function getCharInventoryHeight(char: CharacterInfo) {
    if (!inventoryCapacityStat || inventoryCapacityRowsPerPoint === 0) return inventoryGridHeight;
    const stat = char.stats.find((s) => s.name === inventoryCapacityStat);
    const bonus = stat ? Math.floor(stat.currentValue * inventoryCapacityRowsPerPoint) : 0;
    return inventoryGridHeight + bonus;
  }

  const myCharacter = characters.find((c) => c.userId === currentUser.id) ?? null;
  const detailViewCharacter = detailViewUserId
    ? characters.find((c) => c.userId === detailViewUserId) ?? null
    : null;

  // Center panel shows character detail for either selected player or GM detail view
  const centerCharacter = detailViewCharacter ?? selectedCharacter;
  const centerCharacterIsDetailView = !!detailViewCharacter;

  function handlePlayerClick(userId: string) {
    setDetailViewUserId(null); // Clear GM detail view if open
    setSelectedPlayerId((prev) => (prev === userId ? null : userId));
    // Mobilde karakter tab'ına geç
    if (window.innerWidth < 768) {
      setMobileTab("character");
    }
  }

  function handleDetailView(userId: string) {
    setSelectedPlayerId(null); // Clear player selection if open
    setDetailViewUserId(userId);
  }

  return (
    <div className="flex h-screen flex-col bg-void">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; {t("room.backToDashboard")}
          </Link>
          <div>
            <h1 className="heading-gothic text-base font-semibold text-zinc-100">
              {sessionName}
            </h1>
            <p className="text-xs text-zinc-500">
              {gamesetName} &middot; GM: {gm.username}
              {status === "OPEN" && (
                <>
                  {" "}&middot;{" "}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className="font-mono text-gold-400 hover:text-gold-300"
                    title={t("room.clickToCopy")}
                  >
                    {codeCopied ? "Kopyalandı!" : inviteCode}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium ${STATUS_KEYS[status]?.color}`}
          >
            {t(STATUS_KEYS[status]?.label)}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-zinc-600"}`}
            title={connected ? t("room.connected") : t("room.disconnected")}
          />
        </div>
      </header>

      {/* Karakter yoksa wizard'a yönlendir */}
      {!currentUser.isGm && !hasChar && !isPendingApproval && !rejectionReason && (
        <div className="border-b border-gold-900/50 bg-gold-900/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gold-400">
              {t("room.noCharacter")}
            </p>
            <Link
              href={`/session/${sessionId}/create-character`}
              className="rounded-md bg-gold-400 px-4 py-1.5 text-sm font-medium text-void hover:bg-gold-500"
            >
              {t("room.createCharacter")}
            </Link>
          </div>
        </div>
      )}

      {/* Bekleyen onay */}
      {!currentUser.isGm && isPendingApproval && (
        <div className="border-b border-lavender-900/50 bg-lavender-900/10 px-4 py-3">
          <p className="text-sm text-lavender-400">
            {t("room.pendingApproval")}
          </p>
        </div>
      )}

      {/* Red bildirimi */}
      {!currentUser.isGm && rejectionReason && (
        <div className="border-b border-red-900/50 bg-red-900/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">
              {rejectionReason}
            </p>
            <Link
              href={`/session/${sessionId}/create-character`}
              className="rounded-md bg-gold-400 px-4 py-1.5 text-sm font-medium text-void hover:bg-gold-500"
            >
              {t("common.tryAgain")}
            </Link>
          </div>
        </div>
      )}

      {/* GM: Onay paneli + Araçlar */}
      {currentUser.isGm && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <ApprovalPanel sessionId={sessionId} socket={socket} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { setShowStoreManager(true); }}
                className="flex items-center gap-1 rounded border border-gold-400/40 px-2.5 py-1 text-[10px] text-gold-400 hover:border-gold-400/70 hover:bg-gold-900/10"
              >
                <Icon name="Inventory" size={11} />Mağaza
                {stores.some((s) => s.isActive) && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-gold-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Oyuncu: Aktif mağaza bildirimi */}
      {!currentUser.isGm && activeStore && (
        <div className="border-b border-gold-900/50 bg-gold-900/10 px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gold-400">
              🛒 &nbsp;<span className="font-semibold">{activeStore.name}</span> mağazası açıldı!
            </p>
            <button
              onClick={() => setShowStorePanel(true)}
              className="rounded bg-gold-400 px-2.5 py-1 text-[10px] font-medium text-void hover:bg-gold-500"
            >
              Alışveriş
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Layout (Desktop) + Tab Layout (Mobile) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Players — desktop only */}
        <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-surface md:block">
          <PlayerList
            gm={gm}
            players={players}
            characters={characters}
            currentUserId={currentUser.id}
            manaLabel={manaLabel}
            socket={socket}
            onPlayerClick={handlePlayerClick}
            onDetailView={currentUser.isGm ? handleDetailView : undefined}
          />
        </aside>

        {/* Center: active mobile tab or chat on desktop */}
        <main className="flex min-h-0 flex-1 flex-col">
          {/* Desktop: chat + optional detail view tabs */}
          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            {centerCharacter ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-4 py-2">
                  <button
                    onClick={() => {
                      if (centerCharacterIsDetailView) setDetailViewUserId(null);
                      else setSelectedPlayerId(null);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    &larr; {t("room.chatTab")}
                  </button>
                  <span className="text-xs text-zinc-400">
                    {centerCharacter.name} — Detaylar
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <CharacterDetailPanel
                    character={centerCharacter}
                    isGm={currentUser.isGm}
                    isOwn={centerCharacter.userId === currentUser.id}
                    manaLabel={manaLabel}
                    hpSystem={hpSystem}
                    realisticHpStates={realisticHpStates}
                    skillTreeNodes={skillTreeNodes}
                    socket={socket}
                    gamesetId={gamesetId}
                    inventoryGridWidth={inventoryGridWidth}
                    inventoryGridHeight={getCharInventoryHeight(centerCharacter)}
                    equipmentSlotsEnabled={equipmentSlotsEnabled}
                    currencies={currencies}
                    otherCharacters={characters.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
                    lootItems={lootItems}
                    onAddLoot={currentUser.isGm ? () => { setShowLootAdd(true); loadLootGamesetItems(); } : undefined}
                    onClose={() => {
                      if (centerCharacterIsDetailView) setDetailViewUserId(null);
                      else setSelectedPlayerId(null);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                {/* Chat / Combat Log tab toggle */}
                <div className="flex shrink-0 border-b border-border bg-surface">
                  <button
                    onClick={() => setCenterChatTab("chat")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                      centerChatTab === "chat"
                        ? "border-b-2 border-lavender-400 text-lavender-400"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon name="chat" size={14} />
                    {t("room.chatTab")}
                  </button>
                  <button
                    onClick={() => setCenterChatTab("combatLog")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
                      centerChatTab === "combatLog"
                        ? "border-b-2 border-red-400 text-red-400"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon name="skull" size={14} />
                    {t("room.combatLogTab")}
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  {centerChatTab === "chat" ? (
                    <ChatPanel
                      sessionId={sessionId}
                      socket={socket}
                      connected={connected}
                      currentUser={currentUser}
                    />
                  ) : (
                    <CombatLogPanel
                      sessionId={sessionId}
                      socket={socket}
                      connected={connected}
                      currentUser={currentUser}
                      characters={characters.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile: tab-based */}
          <div className="flex flex-1 flex-col md:hidden">
            {mobileTab === "chat" && (
              <ChatPanel
                sessionId={sessionId}
                socket={socket}
                connected={connected}
                currentUser={currentUser}
              />
            )}
            {mobileTab === "combatLog" && (
              <CombatLogPanel
                sessionId={sessionId}
                socket={socket}
                connected={connected}
                currentUser={currentUser}
                characters={characters.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
              />
            )}
            {mobileTab === "players" && (
              <PlayerList
                gm={gm}
                players={players}
                characters={characters}
                currentUserId={currentUser.id}
                manaLabel={manaLabel}
                socket={socket}
                onPlayerClick={handlePlayerClick}
                onDetailView={currentUser.isGm ? handleDetailView : undefined}
              />
            )}
            {mobileTab === "dice" && (
              <DicePanel socket={socket} connected={connected} currentUser={currentUser} />
            )}
            {mobileTab === "character" && selectedCharacter && (
              <CharacterDetailPanel
                character={selectedCharacter}
                isGm={currentUser.isGm}
                isOwn={selectedCharacter.userId === currentUser.id}
                manaLabel={manaLabel}
                hpSystem={hpSystem}
                realisticHpStates={realisticHpStates}
                skillTreeNodes={skillTreeNodes}
                socket={socket}
                gamesetId={gamesetId}
                inventoryGridWidth={inventoryGridWidth}
                inventoryGridHeight={getCharInventoryHeight(selectedCharacter)}
                equipmentSlotsEnabled={equipmentSlotsEnabled}
                currencies={currencies}
                otherCharacters={characters.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
                lootItems={lootItems}
                onAddLoot={currentUser.isGm ? () => { setShowLootAdd(true); loadLootGamesetItems(); } : undefined}
                onClose={() => {
                  setSelectedPlayerId(null);
                  setMobileTab("players");
                }}
              />
            )}
            {mobileTab === "myChar" && myCharacter && (
              <CharacterDetailPanel
                character={myCharacter}
                isGm={false}
                isOwn={true}
                manaLabel={manaLabel}
                hpSystem={hpSystem}
                realisticHpStates={realisticHpStates}
                skillTreeNodes={skillTreeNodes}
                socket={socket}
                gamesetId={gamesetId}
                inventoryGridWidth={inventoryGridWidth}
                inventoryGridHeight={getCharInventoryHeight(myCharacter)}
                equipmentSlotsEnabled={equipmentSlotsEnabled}
                currencies={currencies}
                otherCharacters={characters.map((c) => ({ id: c.id, name: c.name, userId: c.userId }))}
                lootItems={lootItems}
                onClose={() => setMobileTab("chat")}
              />
            )}
          </div>
        </main>

        {/* Right: Dice panel — always visible on desktop */}
        <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-surface lg:block">
          <DicePanel socket={socket} connected={connected} currentUser={currentUser} />
        </aside>
      </div>

      {/* GM: Mağaza Yönetimi Modal */}
      {showStoreManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative flex h-[90vh] w-full max-w-md flex-col rounded-lg border border-border bg-surface shadow-2xl">
            <StoreManager
              sessionId={sessionId}
              gamesetId={gamesetId}
              socket={socket}
              stores={stores}
              currencies={currencies}
              onStoresChange={setStores}
              onClose={() => setShowStoreManager(false)}
            />
          </div>
        </div>
      )}

      {/* Oyuncu: Mağaza Paneli Modal */}
      {showStorePanel && activeStore && myCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative flex h-[85vh] w-full max-w-sm flex-col rounded-lg border border-border bg-surface shadow-2xl">
            <StorePanel
              store={activeStore}
              characterId={myCharacter.id}
              sessionId={sessionId}
              socket={socket}
              currencies={currencies}
              onClose={() => setShowStorePanel(false)}
              myOfferResults={myOfferResults}
            />
          </div>
        </div>
      )}

      {/* GM: Loot Havuzuna Eşya Ekle Modal */}
      {showLootAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Loot Havuzuna Ekle</h3>
              <button onClick={() => setShowLootAdd(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <div className="relative mb-2">
              <input
                value={lootAddSearch}
                onChange={(e) => setLootAddSearch(e.target.value)}
                placeholder="Eşya ara... (boş bırakın = tümü)"
                autoFocus
                className="w-full rounded border border-border bg-void px-2 py-1.5 text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-gold-400 focus:outline-none"
              />
              {lootAddSearch && (
                <button
                  onClick={() => setLootAddSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300"
                >✕</button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto rounded border border-border">
              {lootGamesetItems.length === 0 ? (
                <p className="py-3 text-center text-[9px] text-zinc-600">Yükleniyor...</p>
              ) : (
                lootGamesetItems
                  .filter((i) => i.name.toLowerCase().includes(lootAddSearch.toLowerCase()))
                  .map((item) => (
                    <button
                      key={item.id}
                      disabled={lootAddBusy}
                      onClick={() => handleAddToLoot(item.id)}
                      className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] text-zinc-300 hover:bg-surface-raised border-b border-border/50 last:border-0"
                    >
                      <span>{item.name}</span>
                      <span className="text-[9px] text-zinc-500">{item.category}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile tab bar */}
      <nav className="flex border-t border-border bg-surface md:hidden">
        {([
          { key: "chat" as const, label: t("room.chatTab"), icon: "chat" },
          { key: "combatLog" as const, label: t("room.combatLogTab"), icon: "skull" },
          { key: "players" as const, label: t("room.playersTab"), icon: "user" },
          { key: "dice" as const, label: t("room.diceTab"), icon: "d20" },
          ...(!currentUser.isGm && myCharacter
            ? [{ key: "myChar" as const, label: "Karakterim", icon: "Shield" }]
            : []),
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
              mobileTab === tab.key
                ? "border-t-2 border-lavender-400 text-lavender-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
