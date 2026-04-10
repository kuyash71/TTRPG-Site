"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { StoreData } from "./store-manager";
import type { CurrencyDef } from "@/types/gameset-config";

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
  currencies: CurrencyDef[];
  onClose: () => void;
  myOfferResults: Record<string, { status: "APPROVED" | "REJECTED" | "ERROR"; message?: string }>; // txId → sonuç
}

function formatPrice(price: Record<string, number>, currencies: CurrencyDef[]): string {
  const parts: string[] = [];
  for (const cur of currencies) {
    const amount = price[cur.code];
    if (amount && amount > 0) parts.push(`${amount}${cur.symbol}`);
  }
  return parts.length ? parts.join(" ") : "—";
}

export function StorePanel({ store, characterId, socket, currencies, onClose, myOfferResults }: Props) {
  // offerPrices[storeItemId][currencyCode] = string input
  const [offerPrices, setOfferPrices] = useState<Record<string, Record<string, string>>>({});
  const [submittedItems, setSubmittedItems] = useState<string[]>([]);
  const [pendingTxByItem, setPendingTxByItem] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // store:new_offer'ı dinleyerek storeItemId → txId mapping'i kur
  // (server txId'yi üretiyor, biz player olarak room broadcast'ından yakalıyoruz)
  useEffect(() => {
    if (!socket) return;
    function handleNewOffer({ transaction }: { transaction: { id: string; storeItemId: string; characterId: string } }) {
      if (transaction.characterId !== characterId) return;
      setPendingTxByItem((prev) => ({ ...prev, [transaction.storeItemId]: transaction.id }));
    }
    socket.on("store:new_offer", handleNewOffer);
    return () => {
      socket.off("store:new_offer", handleNewOffer);
    };
  }, [socket, characterId]);

  // ERROR sonucunda submit kilidini aç ki oyuncu yeniden teklif verebilsin
  useEffect(() => {
    setSubmittedItems((prev) => {
      if (prev.length === 0) return prev;
      const erroredItemIds = new Set<string>();
      for (const [itemId, txId] of Object.entries(pendingTxByItem)) {
        const result = myOfferResults[txId];
        if (result?.status === "ERROR") erroredItemIds.add(itemId);
      }
      if (erroredItemIds.size === 0) return prev;
      return prev.filter((id) => !erroredItemIds.has(id));
    });
  }, [myOfferResults, pendingTxByItem]);

  function setOfferAmount(storeItemId: string, code: string, value: string) {
    setOfferPrices((prev) => ({
      ...prev,
      [storeItemId]: { ...(prev[storeItemId] ?? {}), [code]: value },
    }));
  }

  function getOfferRecord(storeItemId: string): Record<string, number> {
    const raw = offerPrices[storeItemId] ?? {};
    const out: Record<string, number> = {};
    for (const [code, str] of Object.entries(raw)) {
      const n = parseInt(str);
      if (!isNaN(n) && n > 0) out[code] = n;
    }
    return out;
  }

  async function handleOffer(storeItemId: string) {
    if (!socket || busy) return;
    const offered = getOfferRecord(storeItemId);
    if (Object.keys(offered).length === 0) return;

    setBusy(true);
    socket.emit("store:offer", {
      storeId: store.id,
      storeItemId,
      characterId,
      offeredPrice: offered,
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
              const basePrice = (item.basePrice as Record<string, number>) ?? {};
              const hasAnyAmount = Object.keys(getOfferRecord(item.id)).length > 0;

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
                      <p className="text-[11px] font-bold text-gold-400">{formatPrice(basePrice, currencies)}</p>
                      <p className="text-[9px] text-zinc-600">Taban fiyat</p>
                    </div>
                  </div>

                  {isSubmitted ? (
                    <div className="rounded bg-lavender-900/30 px-2 py-1.5 text-center text-[9px] text-lavender-400">
                      Teklifiniz GM&apos;e iletildi...
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-zinc-500">Teklifiniz</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {currencies.map((cur) => (
                          <div
                            key={cur.code}
                            className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1"
                          >
                            <span className="text-[10px]">{cur.symbol}</span>
                            <input
                              type="number"
                              min="0"
                              placeholder={String(basePrice[cur.code] ?? 0)}
                              value={offerPrices[item.id]?.[cur.code] ?? ""}
                              onChange={(e) => setOfferAmount(item.id, cur.code, e.target.value)}
                              className="w-full bg-transparent text-[10px] text-zinc-200 focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleOffer(item.id)}
                        disabled={busy || !hasAnyAmount}
                        className="w-full rounded bg-gold-400 px-3 py-1.5 text-[10px] font-medium text-void hover:bg-gold-500 disabled:opacity-40"
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
          {Object.entries(myOfferResults).map(([txId, result]) => {
            const cls =
              result.status === "APPROVED"
                ? "bg-green-900/30 text-green-400"
                : result.status === "ERROR"
                  ? "bg-amber-900/30 text-amber-300"
                  : "bg-red-900/30 text-red-400";
            const text =
              result.status === "APPROVED"
                ? "✓ Teklifiniz kabul edildi! Eşya envanterinize eklendi."
                : result.status === "ERROR"
                  ? `⚠ Hata: ${result.message ?? "Bilinmeyen hata"}`
                  : "✗ Teklifiniz reddedildi.";
            return (
              <div key={txId} className={`mb-1 rounded px-2 py-1 text-[10px] ${cls}`}>
                {text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
