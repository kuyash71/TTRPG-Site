"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  channel: "IC" | "OOC";
  content: string;
  createdAt: string;
}

interface Props {
  sessionId: string;
  socket: Socket | null;
  currentUser: { id: string; username: string; isGm: boolean };
}

export function ChatPanel({ sessionId, socket, currentUser }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [channel, setChannel] = useState<"IC" | "OOC">("OOC");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      });
  }, [sessionId]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    function handleMessage(msg: ChatMsg) {
      setMessages((prev) => [...prev, msg]);
    }

    socket.on("chat:message", handleMessage);
    return () => {
      socket.off("chat:message", handleMessage);
    };
  }, [socket]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!socket || !input.trim()) return;

    socket.emit("chat:send", { content: input.trim(), channel });
    setInput("");
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Channel tabs */}
      <div className="flex border-b border-border bg-surface">
        {(["OOC", "IC"] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              channel === ch
                ? ch === "IC"
                  ? "border-b-2 border-lavender-400 text-lavender-400"
                  : "border-b-2 border-zinc-400 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {ch === "IC" ? "In-Character" : "Out-of-Character"}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {messages
            .filter((m) => m.channel === channel)
            .map((m) => (
              <div key={m.id} className="group">
                <span
                  className={`text-sm font-medium ${
                    m.userId === currentUser.id
                      ? "text-lavender-400"
                      : "text-zinc-300"
                  }`}
                >
                  {m.username}
                </span>
                <span className="ml-2 text-sm text-zinc-400">{m.content}</span>
                <span className="ml-2 text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {new Date(m.createdAt).toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border bg-surface p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              channel === "IC"
                ? "Karakterin olarak yaz..."
                : "Mesajını yaz..."
            }
            className="flex-1 rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 transition-colors focus:border-lavender-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-lavender-400 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-lavender-500"
          >
            Gönder
          </button>
        </div>
      </form>
    </div>
  );
}
