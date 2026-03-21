"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkCollision, type GridItem } from "@/lib/inventory-grid";

// ─── Types ──────────────────────────────────────────────

interface ItemDefinition {
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
}

interface InventoryItem {
  id: string;
  itemDefinitionId: string;
  posX: number;
  posY: number;
  quantity: number;
  isEquipped: boolean;
  equippedSlot: string | null;
  itemDefinition: ItemDefinition;
}

interface Props {
  characterId: string;
  items: InventoryItem[];
  gridWidth: number;
  gridHeight: number;
  equipmentSlotsEnabled: boolean;
  isOwner: boolean;
  isGm: boolean;
}

const CELL_SIZE = 48;

const EQUIPMENT_SLOTS = [
  { key: "HEAD", label: "Kafa" },
  { key: "CHEST", label: "Göğüs" },
  { key: "LEGS", label: "Bacak" },
  { key: "FEET", label: "Ayak" },
  { key: "MAIN_HAND", label: "Ana El" },
  { key: "OFF_HAND", label: "Yan El" },
  { key: "ACCESSORY_1", label: "Aksesuar 1" },
  { key: "ACCESSORY_2", label: "Aksesuar 2" },
] as const;

const RARITY_BORDER: Record<string, string> = {
  COMMON: "border-zinc-600",
  UNCOMMON: "border-green-500",
  RARE: "border-blue-500",
  EPIC: "border-purple-500",
  LEGENDARY: "border-yellow-500",
};

const RARITY_BG: Record<string, string> = {
  COMMON: "bg-zinc-800/60",
  UNCOMMON: "bg-green-900/30",
  RARE: "bg-blue-900/30",
  EPIC: "bg-purple-900/30",
  LEGENDARY: "bg-yellow-900/20",
};

// ─── Component ──────────────────────────────────────────

export function InventoryPanel({
  characterId,
  items: initialItems,
  gridWidth,
  gridHeight,
  equipmentSlotsEnabled,
  isOwner,
  isGm,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = isOwner || isGm;
  const gridItems = items.filter((i) => !i.isEquipped);
  const equippedItems = items.filter((i) => i.isEquipped);

  // ─── Drag & Drop: Grid ────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, item: InventoryItem) => {
      if (!canEdit) return;
      e.dataTransfer.setData("text/plain", item.id);
      e.dataTransfer.setData("source", item.isEquipped ? "equipment" : "grid");
      setDraggingId(item.id);
    },
    [canEdit]
  );

  const handleGridDragOver = useCallback(
    (e: React.DragEvent, cellX: number, cellY: number) => {
      e.preventDefault();
      setHoverCell({ x: cellX, y: cellY });
    },
    []
  );

  const handleGridDrop = useCallback(
    async (e: React.DragEvent, cellX: number, cellY: number) => {
      e.preventDefault();
      setHoverCell(null);
      setDraggingId(null);

      const itemId = e.dataTransfer.getData("text/plain");
      const source = e.dataTransfer.getData("source");
      const item = items.find((i) => i.id === itemId);
      if (!item || busy) return;

      // If coming from equipment slot, unequip first
      if (source === "equipment") {
        setBusy(true);
        const res = await fetch(
          `/api/characters/${characterId}/inventory/${itemId}/unequip`,
          { method: "PATCH" }
        );
        if (!res.ok) {
          setBusy(false);
          return;
        }
        // Then move to grid position
        const moveRes = await fetch(
          `/api/characters/${characterId}/inventory/${itemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ posX: cellX, posY: cellY }),
          }
        );
        if (moveRes.ok) {
          router.refresh();
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? { ...i, isEquipped: false, equippedSlot: null, posX: cellX, posY: cellY }
                : i
            )
          );
        }
        setBusy(false);
        return;
      }

      // Client-side collision check
      const placing: GridItem = {
        id: itemId,
        posX: cellX,
        posY: cellY,
        gridWidth: item.itemDefinition.gridWidth,
        gridHeight: item.itemDefinition.gridHeight,
      };
      const existing: GridItem[] = gridItems.map((i) => ({
        id: i.id,
        posX: i.posX,
        posY: i.posY,
        gridWidth: i.itemDefinition.gridWidth,
        gridHeight: i.itemDefinition.gridHeight,
      }));

      if (checkCollision(existing, placing, gridWidth, gridHeight, itemId)) return;

      // API call
      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/inventory/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posX: cellX, posY: cellY }),
        }
      );
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, posX: cellX, posY: cellY } : i
          )
        );
      }
      setBusy(false);
    },
    [items, gridItems, gridWidth, gridHeight, characterId, busy, router]
  );

  // ─── Equip ────────────────────────────────────────────

  const handleEquipDrop = useCallback(
    async (e: React.DragEvent, slot: string) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData("text/plain");
      const item = items.find((i) => i.id === itemId);
      if (!item || busy) return;
      if (item.itemDefinition.equipmentSlot !== slot) return;

      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/inventory/${itemId}/equip`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot }),
        }
      );
      if (res.ok) {
        router.refresh();
        setItems((prev) =>
          prev.map((i) => {
            // Unequip anything currently in this slot
            if (i.equippedSlot === slot && i.id !== itemId) {
              return { ...i, isEquipped: false, equippedSlot: null };
            }
            if (i.id === itemId) {
              return { ...i, isEquipped: true, equippedSlot: slot };
            }
            return i;
          })
        );
      }
      setBusy(false);
    },
    [items, characterId, busy, router]
  );

  const handleUnequip = useCallback(
    async (itemId: string) => {
      if (busy || !canEdit) return;
      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/inventory/${itemId}/unequip`,
        { method: "PATCH" }
      );
      if (res.ok) {
        router.refresh();
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? { ...i, isEquipped: false, equippedSlot: null }
              : i
          )
        );
      }
      setBusy(false);
    },
    [characterId, busy, canEdit, router]
  );

  // ─── Delete ───────────────────────────────────────────

  const handleDelete = useCallback(
    async (itemId: string) => {
      if (busy || !canEdit) return;
      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/inventory/${itemId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setSelectedItem(null);
      }
      setBusy(false);
    },
    [characterId, busy, canEdit]
  );

  // ─── Render ───────────────────────────────────────────

  // Highlight cells for hover preview
  const hoverValid =
    hoverCell && draggingId
      ? (() => {
          const item = items.find((i) => i.id === draggingId);
          if (!item) return false;
          const placing: GridItem = {
            id: draggingId,
            posX: hoverCell.x,
            posY: hoverCell.y,
            gridWidth: item.itemDefinition.gridWidth,
            gridHeight: item.itemDefinition.gridHeight,
          };
          const existing: GridItem[] = gridItems.map((i) => ({
            id: i.id,
            posX: i.posX,
            posY: i.posY,
            gridWidth: i.itemDefinition.gridWidth,
            gridHeight: i.itemDefinition.gridHeight,
          }));
          return !checkCollision(existing, placing, gridWidth, gridHeight, draggingId);
        })()
      : false;

  return (
    <div className="space-y-6">
      <h2 className="heading-gothic text-sm font-semibold text-zinc-400">
        Envanter
      </h2>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Equipment Slots */}
        {equipmentSlotsEnabled && (
          <div className="shrink-0">
            <h3 className="mb-2 text-xs font-medium text-zinc-500">
              Kuşanılmış
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPMENT_SLOTS.map(({ key, label }) => {
                const equipped = equippedItems.find(
                  (i) => i.equippedSlot === key
                );
                return (
                  <div
                    key={key}
                    className={`flex h-16 w-28 flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors ${
                      equipped
                        ? `border-solid ${RARITY_BORDER[equipped.itemDefinition.rarity] ?? "border-zinc-600"} ${RARITY_BG[equipped.itemDefinition.rarity] ?? "bg-zinc-800/60"}`
                        : "border-zinc-700 bg-void"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleEquipDrop(e, key)}
                  >
                    {equipped ? (
                      <button
                        className="flex h-full w-full flex-col items-center justify-center"
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, equipped)}
                        onClick={() =>
                          canEdit
                            ? handleUnequip(equipped.id)
                            : setSelectedItem(equipped)
                        }
                        title={`${equipped.itemDefinition.name} — Tıkla: çıkar`}
                      >
                        <span className="truncate text-[10px] font-medium text-zinc-200">
                          {equipped.itemDefinition.name}
                        </span>
                        <span className="text-[9px] text-zinc-500">
                          {label}
                        </span>
                      </button>
                    ) : (
                      <span className="text-[9px] text-zinc-600">{label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inventory Grid */}
        <div className="flex-1 overflow-x-auto">
          <h3 className="mb-2 text-xs font-medium text-zinc-500">
            Çanta ({gridWidth}&times;{gridHeight})
          </h3>
          <div
            className="relative border border-border bg-void"
            style={{
              width: gridWidth * CELL_SIZE,
              height: gridHeight * CELL_SIZE,
            }}
          >
            {/* Grid cells */}
            {Array.from({ length: gridHeight }, (_, y) =>
              Array.from({ length: gridWidth }, (_, x) => {
                const isHover =
                  hoverCell &&
                  draggingId &&
                  (() => {
                    const item = items.find((i) => i.id === draggingId);
                    if (!item) return false;
                    return (
                      x >= hoverCell.x &&
                      x < hoverCell.x + item.itemDefinition.gridWidth &&
                      y >= hoverCell.y &&
                      y < hoverCell.y + item.itemDefinition.gridHeight
                    );
                  })();

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`absolute border border-zinc-800/50 transition-colors ${
                      isHover
                        ? hoverValid
                          ? "bg-lavender-400/20"
                          : "bg-red-400/20"
                        : ""
                    }`}
                    style={{
                      left: x * CELL_SIZE,
                      top: y * CELL_SIZE,
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                    }}
                    onDragOver={(e) => handleGridDragOver(e, x, y)}
                    onDrop={(e) => handleGridDrop(e, x, y)}
                    onDragLeave={() => setHoverCell(null)}
                  />
                );
              })
            )}

            {/* Items on grid */}
            {gridItems.map((item) => (
              <div
                key={item.id}
                className={`absolute cursor-pointer rounded border-2 transition-shadow hover:shadow-lg ${
                  RARITY_BORDER[item.itemDefinition.rarity] ?? "border-zinc-600"
                } ${RARITY_BG[item.itemDefinition.rarity] ?? "bg-zinc-800/60"} ${
                  draggingId === item.id ? "opacity-40" : ""
                }`}
                style={{
                  left: item.posX * CELL_SIZE + 1,
                  top: item.posY * CELL_SIZE + 1,
                  width: item.itemDefinition.gridWidth * CELL_SIZE - 2,
                  height: item.itemDefinition.gridHeight * CELL_SIZE - 2,
                }}
                draggable={canEdit}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setHoverCell(null);
                }}
                onClick={() => setSelectedItem(item)}
                title={item.itemDefinition.name}
              >
                <div className="flex h-full flex-col items-center justify-center p-0.5">
                  <span className="truncate text-center text-[10px] font-medium leading-tight text-zinc-200">
                    {item.itemDefinition.name}
                  </span>
                  {item.quantity > 1 && (
                    <span className="text-[9px] text-zinc-400">
                      x{item.quantity}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Item Detail Tooltip */}
      {selectedItem && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4
                className={`font-medium ${
                  selectedItem.itemDefinition.rarity === "LEGENDARY"
                    ? "text-yellow-400"
                    : selectedItem.itemDefinition.rarity === "EPIC"
                      ? "text-purple-400"
                      : selectedItem.itemDefinition.rarity === "RARE"
                        ? "text-blue-400"
                        : selectedItem.itemDefinition.rarity === "UNCOMMON"
                          ? "text-green-400"
                          : "text-zinc-200"
                }`}
              >
                {selectedItem.itemDefinition.name}
              </h4>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                <span>{selectedItem.itemDefinition.category}</span>
                <span>{selectedItem.itemDefinition.rarity}</span>
                {selectedItem.itemDefinition.equipmentSlot && (
                  <span>
                    Slot:{" "}
                    {
                      EQUIPMENT_SLOTS.find(
                        (s) =>
                          s.key === selectedItem.itemDefinition.equipmentSlot
                      )?.label ?? selectedItem.itemDefinition.equipmentSlot
                    }
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              &times;
            </button>
          </div>

          {selectedItem.itemDefinition.description && (
            <p className="mt-2 text-xs text-zinc-400">
              {selectedItem.itemDefinition.description}
            </p>
          )}

          {/* Stat Bonuses */}
          {Object.keys(selectedItem.itemDefinition.statBonuses).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(selectedItem.itemDefinition.statBonuses).map(
                ([key, val]) => (
                  <span
                    key={key}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      val > 0
                        ? "bg-green-900/40 text-green-400"
                        : "bg-red-900/40 text-red-400"
                    }`}
                  >
                    {key} {val > 0 ? "+" : ""}
                    {val}
                  </span>
                )
              )}
            </div>
          )}

          {/* Actions */}
          {canEdit && (
            <div className="mt-3 flex gap-2">
              {!selectedItem.isEquipped &&
                selectedItem.itemDefinition.equipmentSlot && (
                  <button
                    onClick={async () => {
                      if (busy) return;
                      setBusy(true);
                      const res = await fetch(
                        `/api/characters/${characterId}/inventory/${selectedItem.id}/equip`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            slot: selectedItem.itemDefinition.equipmentSlot,
                          }),
                        }
                      );
                      if (res.ok) {
                        router.refresh();
                        setItems((prev) =>
                          prev.map((i) => {
                            if (
                              i.equippedSlot ===
                                selectedItem.itemDefinition.equipmentSlot &&
                              i.id !== selectedItem.id
                            ) {
                              return {
                                ...i,
                                isEquipped: false,
                                equippedSlot: null,
                              };
                            }
                            if (i.id === selectedItem.id) {
                              return {
                                ...i,
                                isEquipped: true,
                                equippedSlot:
                                  selectedItem.itemDefinition.equipmentSlot,
                              };
                            }
                            return i;
                          })
                        );
                        setSelectedItem(null);
                      }
                      setBusy(false);
                    }}
                    disabled={busy}
                    className="rounded bg-lavender-400/20 px-3 py-1 text-xs text-lavender-300 transition-colors hover:bg-lavender-400/30 disabled:opacity-50"
                  >
                    Kuşan
                  </button>
                )}
              {selectedItem.isEquipped && (
                <button
                  onClick={() => {
                    handleUnequip(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  disabled={busy}
                  className="rounded bg-zinc-700/50 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  Çıkar
                </button>
              )}
              <button
                onClick={() => handleDelete(selectedItem.id)}
                disabled={busy}
                className="rounded bg-red-900/30 px-3 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/50 disabled:opacity-50"
              >
                Düşür
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
