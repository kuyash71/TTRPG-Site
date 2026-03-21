"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface DiceResult {
  id: string;
  userId: string;
  username: string;
  notation: string;
  output: string;
  total: number;
  createdAt: string;
}

interface Props {
  socket: Socket | null;
  currentUser: { id: string; username: string; isGm: boolean };
}

const QUICK_ROLLS = ["1d20", "2d6", "1d12", "1d100", "4d6"];

export function DicePanel({ socket, currentUser }: Props) {
  const [rolls, setRolls] = useState<DiceResult[]>([]);
  const [notation, setNotation] = useState("");
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
    socket.emit("dice:roll", { notation: notation.trim() });
    setNotation("");
  }

  function quickRoll(n: string) {
    if (!socket) return;
    socket.emit("dice:roll", { notation: n });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <h2 className="heading-gothic mb-3 text-xs font-semibold text-zinc-400">
          Zar
        </h2>
        {/* Quick rolls */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_ROLLS.map((n) => (
            <button
              key={n}
              onClick={() => quickRoll(n)}
              className="rounded border border-border bg-void px-2 py-1 font-mono text-xs text-zinc-400 transition-colors hover:border-lavender-400 hover:text-lavender-400"
            >
              {n}
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
            className="rounded-md bg-gold-400 px-3 py-1.5 text-sm font-medium text-void transition-colors hover:bg-gold-500"
          >
            At
          </button>
        </form>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {/* Roll history */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {rolls.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border bg-void p-2"
            >
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
              <p className="font-mono text-xs text-zinc-500">{r.output}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
