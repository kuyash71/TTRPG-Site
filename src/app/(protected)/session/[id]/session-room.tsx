"use client";

import { useSocket } from "@/hooks/use-socket";
import { ChatPanel } from "./chat-panel";
import { DicePanel } from "./dice-panel";
import { PlayerList } from "./player-list";
import { ApprovalPanel } from "./approval-panel";
import Link from "next/link";

interface CharacterInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  stats: { name: string; currentValue: number; maxValue: number | null }[];
}

interface Props {
  sessionId: string;
  sessionName: string;
  gamesetName: string;
  status: string;
  gm: { id: string; username: string };
  players: { id: string; username: string }[];
  characters: CharacterInfo[];
  currentUser: { id: string; username: string; isGm: boolean };
  hasCharacter: boolean;
  pendingApproval: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Açık", color: "text-green-400" },
  ACTIVE: { label: "Aktif", color: "text-lavender-400" },
  CLOSING: { label: "Kapanıyor", color: "text-gold-400" },
  CLOSED: { label: "Kapalı", color: "text-zinc-500" },
};

export function SessionRoom({
  sessionId,
  sessionName,
  gamesetName,
  status,
  gm,
  players,
  characters,
  currentUser,
  hasCharacter,
  pendingApproval,
}: Props) {
  const { socket, connected } = useSocket(sessionId);

  return (
    <div className="flex h-screen flex-col bg-void">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; Dashboard
          </Link>
          <div>
            <h1 className="heading-gothic text-base font-semibold text-zinc-100">
              {sessionName}
            </h1>
            <p className="text-xs text-zinc-500">
              {gamesetName} &middot; GM: {gm.username}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium ${statusLabels[status]?.color}`}
          >
            {statusLabels[status]?.label}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-zinc-600"}`}
            title={connected ? "Bağlı" : "Bağlantı yok"}
          />
        </div>
      </header>

      {/* Karakter yoksa wizard'a yönlendir */}
      {!currentUser.isGm && !hasCharacter && !pendingApproval && (
        <div className="border-b border-gold-900/50 bg-gold-900/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gold-400">
              Bu session&apos;da henüz bir karakteriniz yok.
            </p>
            <Link
              href={`/session/${sessionId}/create-character`}
              className="rounded-md bg-gold-400 px-4 py-1.5 text-sm font-medium text-void hover:bg-gold-500"
            >
              Karakter Oluştur
            </Link>
          </div>
        </div>
      )}

      {/* Bekleyen onay */}
      {!currentUser.isGm && pendingApproval && (
        <div className="border-b border-lavender-900/50 bg-lavender-900/10 px-4 py-3">
          <p className="text-sm text-lavender-400">
            Karakter oluşturma isteğiniz GM onayı bekliyor.
          </p>
        </div>
      )}

      {/* GM: Onay paneli */}
      {currentUser.isGm && (
        <div className="border-b border-border px-4 py-3">
          <ApprovalPanel sessionId={sessionId} />
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Players */}
        <aside className="hidden w-56 flex-shrink-0 border-r border-border bg-surface md:block">
          <PlayerList
            gm={gm}
            players={players}
            characters={characters}
            currentUserId={currentUser.id}
            socket={socket}
          />
        </aside>

        {/* Center: Chat */}
        <main className="flex flex-1 flex-col">
          <ChatPanel
            sessionId={sessionId}
            socket={socket}
            currentUser={currentUser}
          />
        </main>

        {/* Right: Dice */}
        <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-surface lg:block">
          <DicePanel socket={socket} currentUser={currentUser} />
        </aside>
      </div>
    </div>
  );
}
