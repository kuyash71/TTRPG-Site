"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";
import type { StoreData } from "./store-manager";

const RARITY_COLOR: Record<string, string> = {
  LEGENDARY: "text-yellow-400",
  EPIC: "text-purple-400",
  RARE: "text-blue-400",
  UNCOMMON: "text-green-400",
  COMMON: "text-zinc-300",
};

const RARITY_BORDER: Record<string, string> = {
  LEGENDARY: "border-yellow-500/30",
  EPIC: "border-purple-500/30",
  RARE: "border-blue-500/30",
  UNCOMMON: "border-green-500/30",
  COMMON: "border-border",
};

interface Props {
  store: StoreData;
  characterId: string;
  sessionId: string;
  socket: Socket | null;
  onClose: () => void;
  myOfferResults: Record<string, "APPROVED" | "REJECTED">; // txId → sonuç
}

export function StorePanel({ store, characterId, socket, onClose, myOfferResults }: Props) {
  const [offerPrices, setOfferPrices] = useState<Record<string, string>>({});
  const [submittedItems, setSubmittedItems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleOffer(storeItemId: string) {
    if (!socket || busy) return;
    const priceStr = offerPrices[storeItemId] ?? "";
    const price = parseInt(priceStr);
    if (isNaN(price) || price < 0) return;

    setBusy(true);
    socket.emit("store:offer", {
      storeId: store.id,
      storeItemId,
      characterId,
      offeredPrice: price,
    });
    setSubmittedItems((prev) => [...prev, storeItemId]);
    setBusy(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="heading-gothic text-sm font-semibold text-zinc-100">{store.name}</h2>
          <p className="text-[10px] text-zinc-500">Fiyat teklifi verin — GM onaylayacak</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
      </div>

      {/* Ürünler */}
      <div className="flex-1 overflow-y-auto p-3">
        {store.items.length === 0 ? (
          <p className="py-8 text-center text-[10px] text-zinc-600">Bu mağazada ürün yok.</p>
        ) : (
          <div className="space-y-3">
            {store.items.map((item) => {
              const isSubmitted = submittedItems.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`rounded border ${RARITY_BORDER[item.itemDefinition.rarity] ?? "border-border"} bg-void p-3`}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className={`text-[11px] font-semibold ${RARITY_COLOR[item.itemDefinition.rarity] ?? "text-zinc-300"}`}>
                        {item.itemDefinition.name}
                      </p>
                      <p className="text-[9px] text-zinc-600">
                        {item.itemDefinition.category} · {item.itemDefinition.gridWidth}×{item.itemDefinition.gridHeight}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-gold-400">{item.basePrice}g</p>
                      <p className="text-[9px] text-zinc-600">Taban fiyat</p>
                    </div>
                  </div>

                  {isSubmitted ? (
                    <div className="rounded bg-lavender-900/30 px-2 py-1.5 text-center text-[9px] text-lavender-400">
                      Teklifiniz GM&apos;e iletildi...
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex flex-1 items-center gap-1 rounded border border-border bg-surface px-2 py-1">
                        <span className="text-[9px] text-zinc-500">Teklifiniz:</span>
                        <input
                          type="number"
                          min="0"
                          placeholder={String(item.basePrice)}
                          value={offerPrices[item.id] ?? ""}
                          onChange={(e) => setOfferPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="flex-1 bg-transparent text-[10px] text-zinc-200 focus:outline-none"
                        />
                        <span className="text-[9px] text-gold-400">g</span>
                      </div>
                      <button
                        onClick={() => handleOffer(item.id)}
                        disabled={busy || !(offerPrices[item.id]?.trim())}
                        className="rounded bg-gold-400 px-3 py-1 text-[10px] font-medium text-void hover:bg-gold-500 disabled:opacity-40"
                      >
                        Teklif Ver
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Teklif sonuçları */}
      {Object.keys(myOfferResults).length > 0 && (
        <div className="border-t border-border p-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Sonuçlar</p>
          {Object.entries(myOfferResults).map(([txId, status]) => (
            <div
              key={txId}
              className={`mb-1 rounded px-2 py-1 text-[10px] ${status === "APPROVED" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
            >
              {status === "APPROVED" ? "✓ Teklifiniz kabul edildi! Eşya envanterinize eklendi." : "✗ Teklifiniz reddedildi."}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
