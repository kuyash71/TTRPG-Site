"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useLocale } from "@/lib/locale";
import { Icon } from "@/components/icon";

interface DiceResult {
  id: string;
  userId: string;
  username: string;
  notation: string;
  output: string;
  total: number;
  title?: string;
  createdAt: string;
}

interface Props {
  socket: Socket | null;
  connected?: boolean;
  currentUser: { id: string; username: string; isGm: boolean };
}

const QUICK_ROLLS = [
  { notation: "1d4", icon: "d4" },
  { notation: "1d6", icon: "d6" },
  { notation: "1d8", icon: "d8" },
  { notation: "1d10", icon: "d10" },
  { notation: "1d12", icon: "d12" },
  { notation: "1d20", icon: "d20" },
  { notation: "1d100", icon: "d100" },
];

export function DicePanel({ socket, connected: connectedProp, currentUser }: Props) {
  const { t } = useLocale();
  const [rolls, setRolls] = useState<DiceResult[]>([]);
  const [notation, setNotation] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    function handleResult(result: DiceResult) {
      setRolls((prev) => [...prev, result]);
    }

    function handleError({ message }: { message: string }) {
      setError(message);
      setTimeout(() => setError(""), 3000);
    }

    socket.on("dice:result", handleResult);
    socket.on("dice:error", handleError);

    return () => {
      socket.off("dice:result", handleResult);
      socket.off("dice:error", handleError);
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rolls]);

  function handleRoll(e: FormEvent) {
    e.preventDefault();
    if (!socket || !notation.trim()) return;
    socket.emit("dice:roll", { notation: notation.trim(), title: title.trim() || undefined });
    setNotation("");
    setTitle("");
  }

  function quickRoll(n: string) {
    if (!socket) return;
    socket.emit("dice:roll", { notation: n, title: title.trim() || undefined });
    setTitle("");
  }

  const isConnected = connectedProp ?? !!socket?.connected;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="heading-gothic mb-3 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
          <Icon name="d20" size={16} /> {t("dice.title")}
          {!isConnected && (
            <span className="ml-1 text-[10px] text-red-400">(bağlantı yok)</span>
          )}
        </h2>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Zar başlığı (opsiyonel)"
          className="mb-2 w-full rounded-md border border-border bg-void px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-lavender-400 focus:outline-none"
        />

        {/* Quick rolls */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_ROLLS.map((r) => (
            <button
              key={r.notation}
              onClick={() => quickRoll(r.notation)}
              disabled={!isConnected}
              className="flex items-center gap-1 rounded border border-border bg-void px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-lavender-400 hover:text-lavender-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon name={r.icon} size={14} />
              {r.notation}
            </button>
          ))}
        </div>

        {/* Custom roll */}
        <form onSubmit={handleRoll} className="flex gap-2">
          <input
            value={notation}
            onChange={(e) => setNotation(e.target.value)}
            placeholder="2d6+3"
            className="flex-1 rounded-md border border-border bg-void px-2 py-1.5 font-mono text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-gold-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!isConnected || !notation.trim()}
            className="rounded-md bg-gold-400 px-3 py-1.5 text-sm font-medium text-void transition-colors hover:bg-gold-500 disabled:opacity-40"
          >
            {t("dice.roll")}
          </button>
        </form>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {/* Roll history */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {rolls.length === 0 && (
            <p className="text-center text-xs text-zinc-600">Henüz zar atılmadı.</p>
          )}
          {rolls.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border bg-void p-2"
            >
              {r.title && (
                <p className="mb-0.5 text-[11px] font-medium text-gold-400">{r.title}</p>
              )}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    r.userId === currentUser.id
                      ? "text-lavender-400"
                      : "text-zinc-300"
                  }`}
                >
                  {r.username}
                </span>
                <span className="font-mono text-lg font-bold text-gold-400">
                  {r.total}
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-500">{r.notation} → {r.output}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
