"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import Link from "next/link";
import { Icon } from "@/components/icon";

interface CharacterInfo {
  id: string;
  userId: string;
  name: string;
  username: string;
  stats: { name: string; currentValue: number; maxValue: number | null }[];
}

interface Props {
  gm: { id: string; username: string };
  players: { id: string; username: string }[];
  characters: CharacterInfo[];
  currentUserId: string;
  manaLabel: string;
  socket: Socket | null;
  onPlayerClick?: (userId: string) => void;
}

export function PlayerList({
  gm,
  players,
  characters,
  currentUserId,
  manaLabel,
  socket,
  onPlayerClick,
}: Props) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [charStats, setCharStats] = useState<
    Record<string, { name: string; currentValue: number; maxValue: number | null }[]>
  >(() => {
    const map: Record<string, { name: string; currentValue: number; maxValue: number | null }[]> = {};
    for (const c of characters) {
      map[c.userId] = c.stats;
    }
    return map;
  });

  useEffect(() => {
    if (!socket) return;

    function handleJoin({ userId }: { userId: string }) {
      setOnlineIds((prev) => new Set(prev).add(userId));
    }

    function handleLeft({ userId }: { userId: string }) {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }

    function handleCharUpdate({
      userId,
      stats,
    }: {
      userId: string;
      stats: { name: string; currentValue: number }[];
    }) {
      setCharStats((prev) => {
        const existing = prev[userId] || [];
        const updated = existing.map((s) => {
          const change = stats.find((st) => st.name === s.name);
          return change ? { ...s, currentValue: change.currentValue } : s;
        });
        return { ...prev, [userId]: updated };
      });
    }

    socket.on("session:player_joined", handleJoin);
    socket.on("session:player_left", handleLeft);
    socket.on("character:updated", handleCharUpdate);

    return () => {
      socket.off("session:player_joined", handleJoin);
      socket.off("session:player_left", handleLeft);
      socket.off("character:updated", handleCharUpdate);
    };
  }, [socket]);

  const allMembers = [
    { ...gm, isGm: true },
    ...players
      .filter((p) => p.id !== gm.id)
      .map((p) => ({ ...p, isGm: false })),
  ];

  return (
    <div className="p-4">
      <h2 className="heading-gothic mb-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
        <Icon name="user" size={14} /> Oyuncular
      </h2>
      <div className="space-y-3">
        {allMembers.map((member) => {
          const char = characters.find((c) => c.userId === member.id);
          const stats = charStats[member.id] || [];
          const hp = stats.find((s) => s.name === "HP");
          const mana = stats.find((s) => s.name === manaLabel || s.name === "Mana" || s.name === "mana" || s.name === "MP");

          return (
            <div
              key={member.id}
              className="cursor-pointer rounded-md border border-border bg-void p-2 transition-colors hover:border-lavender-400/30"
              onClick={() => char && onPlayerClick?.(member.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    onlineIds.has(member.id) || member.id === currentUserId
                      ? "bg-green-400"
                      : "bg-zinc-600"
                  }`}
                />
                <span
                  className={`text-sm ${
                    member.id === currentUserId
                      ? "font-medium text-zinc-100"
                      : "text-zinc-400"
                  }`}
                >
                  {member.username}
                </span>
                {member.isGm && (
                  <span className="flex items-center gap-0.5 rounded bg-gold-900/50 px-1.5 py-0.5 text-[10px] font-medium text-gold-400">
                    <Icon name="crown" size={10} /> GM
                  </span>
                )}
              </div>

              {char && (
                <div className="mt-1.5">
                  <Link
                    href={`/character/${char.id}`}
                    className="text-xs text-lavender-400 hover:text-lavender-300"
                  >
                    {char.name}
                  </Link>

                  {/* HP bar */}
                  {hp && hp.maxValue && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                          <Icon name="health" size={10} /> HP
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {hp.currentValue}/{hp.maxValue}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all"
                          style={{
                            width: `${(hp.currentValue / hp.maxValue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Mana bar */}
                  {mana && mana.maxValue && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                          <Icon name="mana" size={10} /> {manaLabel}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {mana.currentValue}/{mana.maxValue}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${(mana.currentValue / mana.maxValue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
