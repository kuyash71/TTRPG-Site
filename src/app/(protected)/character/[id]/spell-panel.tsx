"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SpellDef {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  cooldown: number;
  range: number;
  targetType: string;
  requiredLevel: number;
}

interface CharacterSpell {
  id: string;
  spellDefinitionId: string;
  slotIndex: number | null;
  spellDefinition: SpellDef;
}

interface Props {
  characterId: string;
  spells: CharacterSpell[];
  maxSpellSlots: number;
  currentMana: number | null;
  isOwner: boolean;
  isGm: boolean;
}

const TARGET_LABELS: Record<string, string> = {
  SELF: "Kendine",
  SINGLE: "Tekli",
  AOE: "Alan",
  LINE: "Çizgi",
};

export function SpellPanel({
  characterId,
  spells: initialSpells,
  maxSpellSlots,
  currentMana,
  isOwner,
  isGm,
}: Props) {
  const router = useRouter();
  const [spells, setSpells] = useState(initialSpells);
  const [busy, setBusy] = useState(false);
  const [castResult, setCastResult] = useState<string | null>(null);

  const canEdit = isOwner || isGm;

  // Slot bar: array of maxSpellSlots
  const slots: (CharacterSpell | null)[] = Array.from({ length: maxSpellSlots }, (_, i) => {
    return spells.find((s) => s.slotIndex === i) ?? null;
  });

  const unslottedSpells = spells.filter((s) => s.slotIndex === null);

  const assignSlot = useCallback(
    async (csId: string, slotIndex: number) => {
      if (busy || !canEdit) return;
      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/spells/${csId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotIndex }),
        }
      );
      if (res.ok) {
        setSpells((prev) =>
          prev.map((s) => {
            // Clear the existing spell in this slot
            if (s.slotIndex === slotIndex && s.id !== csId) {
              return { ...s, slotIndex: null };
            }
            if (s.id === csId) {
              return { ...s, slotIndex };
            }
            return s;
          })
        );
      }
      setBusy(false);
    },
    [characterId, busy, canEdit]
  );

  const removeSlot = useCallback(
    async (csId: string) => {
      if (busy || !canEdit) return;
      setBusy(true);
      const res = await fetch(
        `/api/characters/${characterId}/spells/${csId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotIndex: null }),
        }
      );
      if (res.ok) {
        setSpells((prev) =>
          prev.map((s) => (s.id === csId ? { ...s, slotIndex: null } : s))
        );
      }
      setBusy(false);
    },
    [characterId, busy, canEdit]
  );

  const castSpell = useCallback(
    async (csId: string) => {
      if (busy) return;
      setBusy(true);
      setCastResult(null);
      const res = await fetch(
        `/api/characters/${characterId}/spells/cast`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterSpellId: csId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setCastResult(`${data.spellName} kullanıldı! (Mana: ${data.remainingMana ?? "?"})`);
        router.refresh();
      } else {
        setCastResult(data.error || "Büyü kullanılamadı.");
      }
      setBusy(false);
      setTimeout(() => setCastResult(null), 3000);
    },
    [characterId, busy, router]
  );

  if (spells.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="heading-gothic text-sm font-semibold text-zinc-400">
        Büyüler
      </h2>

      {/* Cast result toast */}
      {castResult && (
        <div className="rounded border border-blue-800/50 bg-blue-950/30 px-3 py-2 text-xs text-blue-300">
          {castResult}
        </div>
      )}

      {/* Spell Slots Bar */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-zinc-500">
          Slot Bar ({maxSpellSlots} slot)
        </h3>
        <div className="flex gap-2">
          {slots.map((spell, i) => (
            <div
              key={i}
              className={`flex h-16 w-20 flex-col items-center justify-center rounded-md border-2 transition-colors ${
                spell
                  ? "border-blue-500/50 bg-blue-950/30"
                  : "border-dashed border-zinc-700 bg-void"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const csId = e.dataTransfer.getData("text/plain");
                if (csId) assignSlot(csId, i);
              }}
            >
              {spell ? (
                <button
                  className="flex h-full w-full flex-col items-center justify-center"
                  onClick={() => canEdit ? castSpell(spell.id) : undefined}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    removeSlot(spell.id);
                  }}
                  disabled={busy || (currentMana !== null && currentMana < spell.spellDefinition.manaCost)}
                  title={`${spell.spellDefinition.name} — Mana: ${spell.spellDefinition.manaCost}\nSol tık: kullan, Sağ tık: slottan çıkar`}
                >
                  <span className="truncate text-[10px] font-medium text-blue-200">
                    {spell.spellDefinition.name}
                  </span>
                  <span className="text-[9px] text-blue-400">
                    {spell.spellDefinition.manaCost} MP
                  </span>
                </button>
              ) : (
                <span className="text-[9px] text-zinc-600">Slot {i + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Known Spells List */}
      {unslottedSpells.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-zinc-500">
            Bilinen Büyüler (slot&apos;a sürükle)
          </h3>
          <div className="flex flex-wrap gap-2">
            {unslottedSpells.map((cs) => (
              <div
                key={cs.id}
                className="cursor-grab rounded border border-blue-900/40 bg-blue-950/20 px-3 py-2"
                draggable={canEdit}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", cs.id);
                }}
              >
                <div className="text-xs font-medium text-blue-300">
                  {cs.spellDefinition.name}
                </div>
                <div className="flex gap-2 text-[9px] text-zinc-500">
                  <span>{cs.spellDefinition.manaCost} MP</span>
                  <span>{TARGET_LABELS[cs.spellDefinition.targetType] ?? cs.spellDefinition.targetType}</span>
                  {cs.spellDefinition.cooldown > 0 && <span>{cs.spellDefinition.cooldown} tur</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
