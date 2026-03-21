"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Stat {
  name: string;
  baseValue: number;
  currentValue: number;
  maxValue: number | null;
  isPublic: boolean;
}

interface Props {
  character: {
    id: string;
    name: string;
    avatarUrl: string | null;
    publicData: Record<string, unknown>;
    privateData: Record<string, unknown>;
    sessionId: string;
    sessionName: string;
    ownerUsername: string;
  };
  stats: Stat[];
  wallet: { gold: number; silver: number; copper: number } | null;
  isOwner: boolean;
  isGm: boolean;
}

export function CharacterSheet({
  character,
  stats,
  wallet,
  isOwner,
  isGm,
}: Props) {
  const router = useRouter();
  const [editingStats, setEditingStats] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const resourceStats = stats.filter((s) => s.maxValue !== null);
  const attributeStats = stats.filter((s) => s.maxValue === null);

  async function handleStatChange(statName: string, value: number) {
    setEditingStats((prev) => ({ ...prev, [statName]: value }));
  }

  async function saveStats() {
    if (Object.keys(editingStats).length === 0) return;
    setSaving(true);

    const statsToUpdate = Object.entries(editingStats).map(([name, currentValue]) => ({
      name,
      currentValue,
    }));

    await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats: statsToUpdate }),
    });

    setEditingStats({});
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/session/${character.sessionId}`}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; {character.sessionName}
          </Link>
          <h1 className="heading-gothic mt-1 text-2xl font-bold text-zinc-100">
            {character.name}
          </h1>
          <p className="text-sm text-zinc-500">
            Oyuncu: {character.ownerUsername}
            {isOwner && (
              <span className="ml-2 rounded bg-lavender-900/50 px-1.5 py-0.5 text-[10px] text-lavender-400">
                Senin
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Resources (HP, Mana) */}
        {resourceStats.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="heading-gothic mb-4 text-sm font-semibold text-zinc-400">
              Kaynaklar
            </h2>
            <div className="space-y-4">
              {resourceStats.map((stat) => {
                const current =
                  editingStats[stat.name] ?? stat.currentValue;
                const percentage = stat.maxValue
                  ? (current / stat.maxValue) * 100
                  : 100;
                const barColor =
                  stat.name === "HP"
                    ? "bg-green-500"
                    : stat.name === "Mana"
                      ? "bg-blue-500"
                      : "bg-lavender-400";

                return (
                  <div key={stat.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-300">
                        {stat.name}
                      </span>
                      <span className="font-mono text-sm text-zinc-400">
                        {current} / {stat.maxValue}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-void">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                      />
                    </div>
                    {(isOwner || isGm) && (
                      <input
                        type="range"
                        min={0}
                        max={stat.maxValue ?? 100}
                        value={current}
                        onChange={(e) =>
                          handleStatChange(stat.name, parseInt(e.target.value))
                        }
                        className="mt-1 w-full accent-lavender-400"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attributes */}
        {attributeStats.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="heading-gothic mb-4 text-sm font-semibold text-zinc-400">
              Nitelikler
              {!isOwner && !isGm && (
                <span className="ml-2 text-[10px] font-normal normal-case text-zinc-600">
                  (sadece public)
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {attributeStats.map((stat) => (
                <div
                  key={stat.name}
                  className="flex items-center justify-between rounded-md border border-border bg-void px-3 py-2"
                >
                  <span className="text-sm text-zinc-400">{stat.name}</span>
                  <span className="font-mono text-lg font-bold text-zinc-100">
                    {stat.currentValue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallet */}
        {wallet && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="heading-gothic mb-4 text-sm font-semibold text-zinc-400">
              Cüzdan
            </h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gold-400">&#9679;</span>
                <span className="font-mono text-sm text-zinc-200">
                  {wallet.gold}
                </span>
                <span className="text-xs text-zinc-500">altın</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">&#9679;</span>
                <span className="font-mono text-sm text-zinc-200">
                  {wallet.silver}
                </span>
                <span className="text-xs text-zinc-500">gümüş</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-700">&#9679;</span>
                <span className="font-mono text-sm text-zinc-200">
                  {wallet.copper}
                </span>
                <span className="text-xs text-zinc-500">bakır</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      {(isOwner || isGm) && Object.keys(editingStats).length > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveStats}
            disabled={saving}
            className="rounded-md bg-lavender-400 px-6 py-2 font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
