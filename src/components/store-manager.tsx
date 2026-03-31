"use client";

import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { CurrencyDef } from "@/types/gameset-config";

const RARITY_COLOR: Record<string, string> = {
  LEGENDARY: "text-yellow-400",
  EPIC: "text-purple-400",
  RARE: "text-blue-400",
  UNCOMMON: "text-green-400",
  COMMON: "text-zinc-300",
};

interface ItemDefinitionMini {
  id: string;
  name: string;
  category: string;
  rarity: string;
  gridWidth: number;
  gridHeight: number;
  equipmentSlot: string | null;
  statBonuses: Record<string, number>;
  description: string | null;
  iconUrl: string | null;
}

interface StoreItemData {
  id: string;
  basePrice: number;
  stock: number | null;
  itemDefinition: ItemDefinitionMini;
}

export interface StoreData {
  id: string;
  name: string;
  isActive: boolean;
  items: StoreItemData[];
}

interface PendingTx {
  id: string;
  offeredPrice: number;
  status: string;
  character: { id: string; name: string; user: { username: string } };
  storeItem: { id: string; basePrice: number; itemDefinition: { name: string; rarity: string } };
}

interface Props {
  sessionId: string;
  gamesetId: string;
  socket: Socket | null;
  stores: StoreData[];
  currencies: CurrencyDef[];
  onStoresChange: (stores: StoreData[]) => void;
  onClose: () => void;
}

export function StoreManager({ sessionId, gamesetId, socket, stores, currencies, onStoresChange, onClose }: Props) {
  const currencySymbol = currencies[0]?.symbol ?? "🪙";
  const [tab, setTab] = useState<"stores" | "offers">("stores");
  const [gamesetItems, setGamesetItems] = useState<ItemDefinitionMini[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [editItems, setEditItems] = useState<{ itemDefinitionId: string; basePrice: number; stock: number | null; name: string; rarity: string }[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [pendingTxs, setPendingTxs] = useState<PendingTx[]>([]);
  const [busy, setBusy] = useState(false);

  // Gameset ürünlerini yükle
  useEffect(() => {
    if (gamesetItems.length > 0) return;
    setLoadingItems(true);
    fetch(`/api/gamesets/${gamesetId}/items`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.items)) setGamesetItems(d.items); })
      .finally(() => setLoadingItems(false));
  }, [gamesetId, gamesetItems.length]);

  // Bekleyen teklifleri yükle (aktif mağaza varsa)
  const loadPendingTxs = useCallback(async () => {
    const activeStore = stores.find((s) => s.isActive);
    if (!activeStore) return;
    const res = await fetch(`/api/sessions/${sessionId}/stores/${activeStore.id}/transactions`);
    if (res.ok) {
      const d = await res.json();
      setPendingTxs(d.transactions ?? []);
    }
  }, [sessionId, stores]);

  useEffect(() => {
    if (tab === "offers") loadPendingTxs();
  }, [tab, loadPendingTxs]);

  // Socket: yeni teklif geldi
  useEffect(() => {
    if (!socket) return;
    function handleNewOffer({ transaction }: { transaction: PendingTx }) {
      setPendingTxs((prev) => [...prev, transaction]);
    }
    function handleOfferResult({ txId }: { txId: string }) {
      setPendingTxs((prev) => prev.filter((t) => t.id !== txId));
    }
    socket.on("store:new_offer", handleNewOffer);
    socket.on("store:offer_result", handleOfferResult);
    return () => {
      socket.off("store:new_offer", handleNewOffer);
      socket.off("store:offer_result", handleOfferResult);
    };
  }, [socket]);

  async function handleCreateStore() {
    if (!newStoreName.trim() || busy) return;
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStoreName.trim(), items: [] }),
    });
    if (res.ok) {
      const d = await res.json();
      onStoresChange([...stores, d.store]);
      setNewStoreName("");
      setShowCreate(false);
    }
    setBusy(false);
  }

  async function handleDeleteStore(storeId: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/sessions/${sessionId}/stores/${storeId}`, { method: "DELETE" });
    onStoresChange(stores.filter((s) => s.id !== storeId));
    setBusy(false);
  }

  async function handleActivate(storeId: string) {
    if (!socket) return;
    socket.emit("store:activate", { storeId });
    onStoresChange(stores.map((s) => ({ ...s, isActive: s.id === storeId })));
  }

  async function handleDeactivate(storeId: string) {
    if (!socket) return;
    socket.emit("store:deactivate", { storeId });
    onStoresChange(stores.map((s) => s.id === storeId ? { ...s, isActive: false } : s));
  }

  function startEdit(store: StoreData) {
    setEditingStore(store);
    setEditItems(store.items.map((i) => ({
      itemDefinitionId: i.itemDefinition.id,
      basePrice: i.basePrice,
      stock: i.stock,
      name: i.itemDefinition.name,
      rarity: i.itemDefinition.rarity,
    })));
  }

  function addEditItem(item: ItemDefinitionMini) {
    if (editItems.length >= 6) return;
    if (editItems.find((e) => e.itemDefinitionId === item.id)) return;
    setEditItems((prev) => [...prev, { itemDefinitionId: item.id, basePrice: 0, stock: null, name: item.name, rarity: item.rarity }]);
  }

  async function handleSaveEdit() {
    if (!editingStore || busy) return;
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/stores/${editingStore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: editItems }),
    });
    if (res.ok) {
      const d = await res.json();
      onStoresChange(stores.map((s) => s.id === d.store.id ? d.store : s));
      setEditingStore(null);
    }
    setBusy(false);
  }

  async function handleApproveOffer(txId: string) {
    if (!socket || busy) return;
    socket.emit("store:approve_offer", { txId, sessionId });
    setPendingTxs((prev) => prev.filter((t) => t.id !== txId));
  }

  async function handleRejectOffer(txId: string) {
    if (!socket || busy) return;
    socket.emit("store:reject_offer", { txId, sessionId });
    setPendingTxs((prev) => prev.filter((t) => t.id !== txId));
  }

  const filteredItems = gamesetItems.filter((i) =>
    i.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="heading-gothic text-sm font-semibold text-zinc-100">Mağaza Yönetimi</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("stores")}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${tab === "stores" ? "border-b-2 border-gold-400 text-gold-400" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Mağazalar ({stores.length})
        </button>
        <button
          onClick={() => setTab("offers")}
          className={`relative flex-1 py-2 text-[11px] font-medium transition-colors ${tab === "offers" ? "border-b-2 border-gold-400 text-gold-400" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Teklifler
          {pendingTxs.length > 0 && (
            <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
              {pendingTxs.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* ─── MAĞAZALAR ─── */}
        {tab === "stores" && !editingStore && (
          <div className="space-y-3">
            {stores.map((store) => (
              <div key={store.id} className={`rounded border ${store.isActive ? "border-gold-500/40 bg-gold-900/10" : "border-border bg-void"} p-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-100">{store.name}</span>
                    {store.isActive && (
                      <span className="ml-2 rounded bg-gold-400/20 px-1.5 py-0.5 text-[8px] text-gold-400">Aktif</span>
                    )}
                    <p className="text-[9px] text-zinc-600">{store.items.length} ürün</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(store)}
                      className="rounded px-2 py-1 text-[9px] text-zinc-400 hover:bg-zinc-800"
                    >
                      Düzenle
                    </button>
                    {store.isActive ? (
                      <button
                        onClick={() => handleDeactivate(store.id)}
                        className="rounded border border-zinc-700 px-2 py-1 text-[9px] text-zinc-400 hover:border-red-700 hover:text-red-400"
                      >
                        Kapat
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(store.id)}
                        className="rounded bg-gold-400 px-2 py-1 text-[9px] font-medium text-void hover:bg-gold-500"
                      >
                        Aç
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteStore(store.id)}
                      className="rounded px-2 py-1 text-[9px] text-zinc-600 hover:text-red-400"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                {store.items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {store.items.map((i) => (
                      <span key={i.id} className={`rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] ${RARITY_COLOR[i.itemDefinition.rarity] ?? "text-zinc-300"}`}>
                        {i.itemDefinition.name} — {currencySymbol}{i.basePrice}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Yeni mağaza oluştur */}
            {showCreate ? (
              <div className="rounded border border-border bg-void p-3">
                <p className="mb-2 text-[10px] font-medium text-zinc-300">Yeni Mağaza</p>
                <input
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Mağaza adı..."
                  className="mb-2 w-full rounded border border-border bg-surface px-2 py-1.5 text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-gold-400 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateStore}
                    disabled={!newStoreName.trim() || busy}
                    className="flex-1 rounded bg-gold-400 py-1.5 text-[10px] font-medium text-void disabled:opacity-40"
                  >
                    Oluştur
                  </button>
                  <button onClick={() => setShowCreate(false)} className="rounded border border-border px-3 py-1.5 text-[10px] text-zinc-400">İptal</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full rounded border border-dashed border-gold-400/40 py-2 text-[10px] text-gold-400 hover:border-gold-400/70"
              >
                + Yeni Mağaza
              </button>
            )}
          </div>
        )}

        {/* ─── MAĞAZA DÜZENLE ─── */}
        {tab === "stores" && editingStore && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingStore(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300">← Geri</button>
              <span className="text-[11px] font-medium text-zinc-200">{editingStore.name} — Ürünler (maks. 6)</span>
            </div>

            {/* Seçili ürünler */}
            <div className="space-y-1">
              {editItems.map((item, idx) => (
                <div key={item.itemDefinitionId} className="flex items-center gap-2 rounded border border-border bg-void px-2 py-1.5">
                  <span className={`flex-1 text-[10px] ${RARITY_COLOR[item.rarity] ?? "text-zinc-300"}`}>{item.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-zinc-500">Fiyat ({currencies[0]?.name ?? "Para"}):</span>
                    <input
                      type="number"
                      min="0"
                      value={item.basePrice}
                      onChange={(e) => setEditItems((prev) => prev.map((it, i) => i === idx ? { ...it, basePrice: Math.max(0, parseInt(e.target.value) || 0) } : it))}
                      className="w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-zinc-200 focus:border-gold-400 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-[9px] text-zinc-600 hover:text-red-400"
                  >✕</button>
                </div>
              ))}
              {editItems.length === 0 && (
                <p className="py-2 text-center text-[9px] text-zinc-600">Henüz ürün eklenmedi. Aşağıdan ekleyin.</p>
              )}
            </div>

            {/* Eşya ara ve ekle */}
            <div>
              <div className="relative mb-1.5">
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Eşya ara... (boş bırakın = tümü)"
                  className="w-full rounded border border-border bg-void px-2 py-1.5 text-[10px] text-zinc-200 placeholder-zinc-600 focus:border-gold-400 focus:outline-none"
                  disabled={editItems.length >= 6}
                />
                {itemSearch && (
                  <button
                    onClick={() => setItemSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    ✕
                  </button>
                )}
              </div>

              {editItems.length >= 6 ? (
                <p className="py-2 text-center text-[9px] text-zinc-500">Maksimum 6 ürüne ulaşıldı.</p>
              ) : loadingItems ? (
                <p className="py-3 text-center text-[9px] text-zinc-600">Eşyalar yükleniyor...</p>
              ) : (
                <>
                  {(() => {
                    const available = filteredItems.filter((i) => !editItems.find((e) => e.itemDefinitionId === i.id));
                    return available.length === 0 ? (
                      <p className="py-2 text-center text-[9px] text-zinc-600">
                        {gamesetItems.length === 0 ? "Bu gameset'te henüz eşya yok." : "Eşya bulunamadı."}
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded border border-border">
                        {available.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addEditItem(item)}
                            className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] hover:bg-surface-raised border-b border-border/50 last:border-0"
                          >
                            <span className={RARITY_COLOR[item.rarity] ?? "text-zinc-300"}>{item.name}</span>
                            <span className="text-[9px] text-zinc-500">{item.category}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="w-full rounded bg-gold-400 py-2 text-[10px] font-medium text-void disabled:opacity-40"
            >
              {busy ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        )}

        {/* ─── TEKLİFLER ─── */}
        {tab === "offers" && (
          <div className="space-y-2">
            {pendingTxs.length === 0 ? (
              <p className="py-6 text-center text-[10px] text-zinc-600">Bekleyen teklif yok.</p>
            ) : (
              pendingTxs.map((tx) => (
                <div key={tx.id} className="rounded border border-gold-900/40 bg-gold-900/10 p-3">
                  <div className="mb-1.5 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-zinc-100">
                        {tx.character.name}
                        <span className="ml-1 text-[9px] text-zinc-500">({tx.character.user.username})</span>
                      </p>
                      <p className={`text-[10px] ${RARITY_COLOR[tx.storeItem.itemDefinition.rarity] ?? "text-zinc-300"}`}>
                        {tx.storeItem.itemDefinition.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-gold-400">{currencySymbol}{tx.offeredPrice}</p>
                      <p className="text-[9px] text-zinc-600">Taban: {currencySymbol}{tx.storeItem.basePrice}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveOffer(tx.id)}
                      className="flex-1 rounded bg-green-700 py-1.5 text-[10px] font-medium text-white hover:bg-green-600"
                    >
                      Onayla
                    </button>
                    <button
                      onClick={() => handleRejectOffer(tx.id)}
                      className="flex-1 rounded bg-red-900/60 py-1.5 text-[10px] font-medium text-red-300 hover:bg-red-900"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
