"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";
import { ChatPanel } from "./chat-panel";
import { DicePanel } from "./dice-panel";
import { PlayerList } from "./player-list";
import { ApprovalPanel } from "./approval-panel";
import { CharacterDetailPanel } from "./character-detail-panel";
import Link from "next/link";
import { useLocale, TranslationKey } from "@/lib/locale";
import { Icon } from "@/components/icon";

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
  equippedItems?: { name: string; slot: string; rarity: string }[];
  inventoryItems?: InventoryItemInfo[];
  spells?: SpellInfo[];
}

interface Props {
  sessionId: string;
  sessionName: string;
  gamesetName: string;
  status: string;
  inviteCode: string;
  gm: { id: string; username: string };
  players: { id: string; username: string }[];
  characters: CharacterInfo[];
  manaLabel: string;
  currentUser: { id: string; username: string; isGm: boolean };
  hasCharacter: boolean;
  pendingApproval: boolean;
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
  status,
  inviteCode,
  gm,
  players,
  characters,
  manaLabel,
  currentUser,
  hasCharacter,
  pendingApproval,
}: Props) {
  const { t } = useLocale();
  const router = useRouter();
  const { socket, connected } = useSocket(sessionId);
  const [mobileTab, setMobileTab] = useState<"chat" | "players" | "dice" | "character">("chat");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(pendingApproval);
  const [hasChar, setHasChar] = useState(hasCharacter);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Socket: onay/red bildirimleri
  useEffect(() => {
    if (!socket) return;

    function handleApproved({ playerId }: { playerId: string }) {
      if (playerId === currentUser.id) {
        setIsPendingApproval(false);
        setHasChar(true);
        setRejectionReason(null);
        router.refresh();
      }
    }

    function handleRejected({ playerId, reason }: { playerId: string; reason?: string }) {
      if (playerId === currentUser.id) {
        setIsPendingApproval(false);
        setRejectionReason(reason || "Karakter isteğiniz reddedildi.");
      }
    }

    socket.on("session:character_approved", handleApproved);
    socket.on("char:approval_rejected", handleRejected);

    return () => {
      socket.off("session:character_approved", handleApproved);
      socket.off("char:approval_rejected", handleRejected);
    };
  }, [socket, currentUser.id, router]);

  const selectedCharacter = selectedPlayerId
    ? characters.find((c) => c.userId === selectedPlayerId) ?? null
    : null;

  function handlePlayerClick(userId: string) {
    setSelectedPlayerId((prev) => (prev === userId ? null : userId));
    // Mobilde karakter tab'ına geç
    if (window.innerWidth < 768) {
      setMobileTab("character");
    }
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
                    onClick={() => navigator.clipboard.writeText(inviteCode)}
                    className="font-mono text-gold-400 hover:text-gold-300"
                    title={t("room.clickToCopy")}
                  >
                    {inviteCode}
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

      {/* GM: Onay paneli */}
      {currentUser.isGm && (
        <div className="border-b border-border px-4 py-3">
          <ApprovalPanel sessionId={sessionId} socket={socket} />
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
          />
        </aside>

        {/* Center: active mobile tab or chat on desktop */}
        <main className="flex flex-1 flex-col">
          {/* Desktop: always chat */}
          <div className="hidden flex-1 flex-col md:flex">
            <ChatPanel
              sessionId={sessionId}
              socket={socket}
              currentUser={currentUser}
            />
          </div>

          {/* Mobile: tab-based */}
          <div className="flex flex-1 flex-col md:hidden">
            {mobileTab === "chat" && (
              <ChatPanel
                sessionId={sessionId}
                socket={socket}
                currentUser={currentUser}
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
              />
            )}
            {mobileTab === "dice" && (
              <DicePanel socket={socket} currentUser={currentUser} />
            )}
            {mobileTab === "character" && selectedCharacter && (
              <CharacterDetailPanel
                character={selectedCharacter}
                isGm={currentUser.isGm}
                isOwn={selectedCharacter.userId === currentUser.id}
                manaLabel={manaLabel}
                onClose={() => {
                  setSelectedPlayerId(null);
                  setMobileTab("players");
                }}
              />
            )}
          </div>
        </main>

        {/* Right: Character detail or Dice — desktop only */}
        {selectedCharacter ? (
          <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-surface lg:block">
            <CharacterDetailPanel
              character={selectedCharacter}
              isGm={currentUser.isGm}
              isOwn={selectedCharacter.userId === currentUser.id}
              manaLabel={manaLabel}
              onClose={() => setSelectedPlayerId(null)}
            />
          </aside>
        ) : (
          <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-surface lg:block">
            <DicePanel socket={socket} currentUser={currentUser} />
          </aside>
        )}
      </div>

      {/* Mobile tab bar */}
      <nav className="flex border-t border-border bg-surface md:hidden">
        {([
          { key: "chat" as const, label: t("room.chatTab"), icon: "chat" },
          { key: "players" as const, label: t("room.playersTab"), icon: "user" },
          { key: "dice" as const, label: t("room.diceTab"), icon: "d20" },
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
