"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useLocale } from "@/lib/locale";
import { Icon } from "@/components/icon";

interface CombatLogEntry {
  id: string;
  gmUserId: string;
  gmUsername: string;
  content: string;
  targetCharacterIds: string[];
  createdAt: string;
}

interface CharacterMini {
  id: string;
  name: string;
  userId: string;
}

interface Props {
  sessionId: string;
  socket: Socket | null;
  connected?: boolean;
  currentUser: { id: string; username: string; isGm: boolean };
  characters: CharacterMini[];
}

export function CombatLogPanel({
  sessionId,
  socket,
  connected: connectedProp,
  currentUser,
  characters,
}: Props) {
  const { t, locale } = useLocale();
  const [entries, setEntries] = useState<CombatLogEntry[]>([]);
  const [input, setInput] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [filterCharId, setFilterCharId] = useState<string>(""); // "" = tümü
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // İlk yükleme: history fetch
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/combat-log`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.entries)) setEntries(data.entries);
      })
      .catch(() => {});
  }, [sessionId]);

  // Socket: yeni girdi & silme & hata
  useEffect(() => {
    if (!socket) return;
    function handleEntry(entry: CombatLogEntry) {
      setEntries((prev) => [...prev, entry]);
    }
    function handleDeleted({ entryId }: { entryId: string }) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    }
    function handleError({ message }: { message: string }) {
      setError(message);
      setTimeout(() => setError(null), 4000);
    }
    socket.on("combat:log_entry", handleEntry);
    socket.on("combat:log_deleted", handleDeleted);
    socket.on("combat:log_error", handleError);
    return () => {
      socket.off("combat:log_entry", handleEntry);
      socket.off("combat:log_deleted", handleDeleted);
      socket.off("combat:log_error", handleError);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, filterCharId]);

  const isConnected = connectedProp ?? !!socket?.connected;

  // Karakter id → ad lookup
  const charNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of characters) map.set(c.id, c.name);
    return map;
  }, [characters]);

  // Filtre uygulanmış girdiler
  const visibleEntries = useMemo(() => {
    if (!filterCharId) return entries;
    return entries.filter((e) => e.targetCharacterIds.includes(filterCharId));
  }, [entries, filterCharId]);

  function toggleTarget(charId: string) {
    setSelectedTargets((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!socket || !isConnected || !input.trim() || !currentUser.isGm) return;
    socket.emit("combat:log_send", {
      content: input.trim(),
      targetCharacterIds: selectedTargets,
    });
    setInput("");
    setSelectedTargets([]);
  }

  function handleDelete(entryId: string) {
    if (!socket || !currentUser.isGm) return;
    socket.emit("combat:log_delete", { entryId });
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Icon name="Filter" size={14} className="text-zinc-500" />
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          {t("combatLog.filter")}:
        </span>
        <select
          value={filterCharId}
          onChange={(e) => setFilterCharId(e.target.value)}
          className="rounded border border-border bg-void px-2 py-1 text-xs text-zinc-200 focus:border-lavender-400 focus:outline-none"
        >
          <option value="">{t("combatLog.filterAll")}</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto p-4">
        {visibleEntries.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-zinc-600">{t("combatLog.empty")}</p>
        ) : (
          <div className="space-y-2">
            {visibleEntries.map((e) => {
              const targetNames = e.targetCharacterIds
                .map((id) => charNameById.get(id))
                .filter((n): n is string => !!n);
              return (
                <div
                  key={e.id}
                  className="group rounded border border-border/60 bg-void/60 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon name="skull" size={12} className="text-red-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
                          GM
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(e.createdAt).toLocaleTimeString(
                            locale === "tr" ? "tr-TR" : "en-US",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                        {e.content}
                      </p>
                      {targetNames.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-[9px] uppercase tracking-wide text-zinc-600">
                            {t("combatLog.targets")}:
                          </span>
                          {targetNames.map((name, i) => (
                            <span
                              key={i}
                              className="rounded bg-red-900/30 px-1.5 py-0.5 text-[10px] text-red-300"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {currentUser.isGm && (
                      <button
                        onClick={() => handleDelete(e.id)}
                        title={t("combatLog.delete")}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Icon name="trash" size={12} className="text-zinc-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer (GM only) */}
      {currentUser.isGm ? (
        <form onSubmit={handleSend} className="border-t border-border bg-surface p-3">
          {/* Target selector */}
          {characters.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {characters.map((c) => {
                const active = selectedTargets.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleTarget(c.id)}
                    className={`rounded border px-2 py-0.5 text-[10px] transition-colors ${
                      active
                        ? "border-red-500 bg-red-900/40 text-red-200"
                        : "border-border bg-void text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mb-2 rounded bg-red-900/30 px-2 py-1 text-[10px] text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("combatLog.placeholder")}
              className="flex-1 rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-red-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!isConnected || !input.trim()}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="skull" size={14} />
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border bg-surface px-3 py-2 text-center text-[10px] text-zinc-600">
          {t("combatLog.gmOnly")}
        </div>
      )}
    </div>
  );
}
