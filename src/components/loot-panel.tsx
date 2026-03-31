"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";
import { Icon } from "@/components/icon";

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

export interface LootItem {
  id: string;
  quantity: number;
  itemDefinition: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    gridWidth: number;
    gridHeight: number;
    equipmentSlot: string | null;
    statBonuses: Record<string, number>;
    rarity: string;
    iconUrl: string | null;
  };
}

interface Props {
  lootItems: LootItem[];
  characterId: string | null;
  sessionId: string;
  gamesetId: string;
  isGm: boolean;
  socket: Socket | null;
  onAddLoot?: () => void; // GM loot ekleme modalını açmak için
}

export function LootPanel({
  lootItems,
  characterId,
  isGm,
  socket,
  onAddLoot,
}: Props) {
  const [takingId, setTakingId] = useState<string | null>(null);

  async function handleTake(lootId: string) {
    if (!characterId || !socket || takingId) return;
    setTakingId(lootId);
    socket.emit("loot:take", { lootId, characterId });
    setTimeout(() => setTakingId(null), 1500);
  }

  function handleRemove(lootId: string) {
    if (!socket) return;
    socket.emit("loot:remove", { lootId });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Loot Havuzu ({lootItems.length})
        </h4>
        {isGm && onAddLoot && (
          <button
            onClick={onAddLoot}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] text-gold-400 hover:bg-gold-900/20"
            title="Loot Ekle"
          >
            <Icon name="Editpen" size={9} /> Ekle
          </button>
        )}
      </div>

      {lootItems.length === 0 ? (
        <p className="py-3 text-center text-[9px] text-zinc-600">
          {isGm ? "Loot havuzu boş. Ekle butonuyla eşya ekleyin." : "Loot havuzu boş."}
        </p>
      ) : (
        <div className="space-y-1">
          {lootItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded border ${RARITY_BORDER[item.itemDefinition.rarity] ?? "border-border"} bg-void px-2 py-1.5`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className={`truncate text-[10px] font-medium ${RARITY_COLOR[item.itemDefinition.rarity] ?? "text-zinc-300"}`}>
                    {item.itemDefinition.name}
                  </span>
                  {item.quantity > 1 && (
                    <span className="shrink-0 rounded bg-zinc-800 px-1 text-[8px] text-zinc-400">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-zinc-600">
                  {item.itemDefinition.category} · {item.itemDefinition.gridWidth}×{item.itemDefinition.gridHeight}
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                {!isGm && characterId && (
                  <button
                    onClick={() => handleTake(item.id)}
                    disabled={takingId === item.id}
                    className="rounded bg-lavender-600 px-1.5 py-0.5 text-[9px] font-medium text-white hover:bg-lavender-500 disabled:opacity-50"
                  >
                    {takingId === item.id ? "..." : "Al"}
                  </button>
                )}
                {isGm && (
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-red-900/20 hover:text-red-400"
                    title="Kaldır"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
