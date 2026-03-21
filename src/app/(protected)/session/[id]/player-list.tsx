"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface Props {
  gm: { id: string; username: string };
  players: { id: string; username: string }[];
  currentUserId: string;
  socket: Socket | null;
}

export function PlayerList({ gm, players, currentUserId, socket }: Props) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

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

    socket.on("session:player_joined", handleJoin);
    socket.on("session:player_left", handleLeft);

    return () => {
      socket.off("session:player_joined", handleJoin);
      socket.off("session:player_left", handleLeft);
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
      <h2 className="heading-gothic mb-3 text-xs font-semibold text-zinc-400">
        Oyuncular
      </h2>
      <div className="space-y-2">
        {allMembers.map((member) => (
          <div key={member.id} className="flex items-center gap-2">
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
              <span className="rounded bg-gold-900/50 px-1.5 py-0.5 text-[10px] font-medium text-gold-400">
                GM
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
