"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SessionData {
  id: string;
  name: string;
  inviteCode: string;
  status: string;
  createdAt: string;
  gm?: { username: string };
  gameset: { name: string };
  players: { user: { id: string; username: string } }[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Açık", color: "text-green-400" },
  ACTIVE: { label: "Aktif", color: "text-lavender-400" },
  CLOSING: { label: "Kapanıyor", color: "text-gold-400" },
  CLOSED: { label: "Kapalı", color: "text-zinc-500" },
};

export function SessionList({ isGm }: { isGm: boolean }) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      });
  }, []);

  async function handleStatusChange(sessionId: string, newStatus: string) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s))
      );
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-gothic mb-4 text-lg font-semibold text-zinc-200">
        {isGm ? "Sessionlarım" : "Katıldığım Sessionlar"}
      </h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {isGm
            ? "Henüz bir session oluşturmadın."
            : "Henüz bir session'a katılmadın. GM'inden davet kodu iste."}
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border bg-void p-4"
            >
              <div>
                <h3 className="font-medium text-zinc-100">{s.name}</h3>
                <p className="text-xs text-zinc-500">
                  {s.gameset.name}
                  {s.gm && <> &middot; GM: {s.gm.username}</>}
                  {" "}&middot; {s.players.length} oyuncu
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isGm && s.status === "OPEN" && (
                  <span className="rounded bg-surface-raised px-2 py-1 font-mono text-xs text-gold-400">
                    {s.inviteCode}
                  </span>
                )}
                <span className={`text-xs font-medium ${statusLabels[s.status]?.color}`}>
                  {statusLabels[s.status]?.label}
                </span>
                {(s.status === "ACTIVE" || s.status === "OPEN") && (
                  <Link
                    href={`/session/${s.id}`}
                    className="rounded-md bg-lavender-400 px-2 py-1 text-xs font-medium text-void transition-colors hover:bg-lavender-500"
                  >
                    Odaya Gir
                  </Link>
                )}
                {isGm && (
                  <StatusActions
                    status={s.status}
                    onChangeStatus={(newStatus) => handleStatusChange(s.id, newStatus)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusActions({
  status,
  onChangeStatus,
}: {
  status: string;
  onChangeStatus: (s: string) => void;
}) {
  const transitions: Record<string, { label: string; next: string }[]> = {
    OPEN: [{ label: "Başlat", next: "ACTIVE" }],
    ACTIVE: [{ label: "Kapat", next: "CLOSING" }],
    CLOSING: [],
    CLOSED: [],
  };

  const actions = transitions[status] || [];

  return (
    <>
      {actions.map((a) => (
        <button
          key={a.next}
          onClick={() => onChangeStatus(a.next)}
          className="rounded-md bg-surface-raised px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-surface-overlay"
        >
          {a.label}
        </button>
      ))}
    </>
  );
}
