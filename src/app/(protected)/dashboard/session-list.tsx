"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, TranslationKey } from "@/lib/locale";

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

const STATUS_KEYS: Record<string, { label: TranslationKey; color: string }> = {
  OPEN: { label: "session.statusOpen", color: "text-green-400" },
  ACTIVE: { label: "session.statusActive", color: "text-lavender-400" },
  CLOSED: { label: "session.statusClosed", color: "text-zinc-500" },
};

const FILTER_KEYS: { value: string; label: TranslationKey }[] = [
  { value: "ALL", label: "session.filterAll" },
  { value: "OPEN", label: "session.statusOpen" },
  { value: "ACTIVE", label: "session.statusActive" },
  { value: "CLOSED", label: "session.statusClosed" },
];

export function SessionList({ isGm }: { isGm: boolean }) {
  const { t } = useLocale();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        setSessions(data);
        setLoading(false);
      });
  }, []);

  async function handleStatusChange(sessionId: string, newStatus: string) {
    if (newStatus === "CLOSED") {
      if (!window.confirm(t("session.confirmClose"))) return;
    }
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

  async function handleDelete(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmDelete(null);
    }
  }

  async function handleLeave(sessionId: string) {
    if (!window.confirm(t("session.confirmRemove"))) return;
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  }

  const filtered = filter === "ALL" ? sessions : sessions.filter((s) => s.status === filter);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-zinc-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="heading-gothic text-lg font-semibold text-zinc-200">
          {isGm ? t("session.myRooms") : t("session.joinedRooms")}
        </h2>
        <div className="flex gap-1 rounded bg-void p-0.5">
          {FILTER_KEYS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === opt.value
                  ? "bg-surface text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t(opt.label)}
              {opt.value !== "ALL" && (
                <span className="ml-1 text-[10px] text-zinc-600">
                  {sessions.filter((s) => s.status === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {sessions.length === 0
            ? isGm
              ? t("session.noRoomsGm")
              : t("session.noRoomsPlayer")
            : t("session.noFilterResults")}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-md border border-border bg-void p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-medium text-zinc-100">{s.name}</h3>
                <p className="text-xs text-zinc-500">
                  {s.gameset.name}
                  {s.gm && <> &middot; GM: {s.gm.username}</>}
                  {" "}&middot; {s.players.length} {t("common.player")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isGm && s.status === "OPEN" && (
                  <span className="rounded bg-surface-raised px-2 py-1 font-mono text-xs text-gold-400">
                    {s.inviteCode}
                  </span>
                )}
                <span className={`text-xs font-medium ${STATUS_KEYS[s.status]?.color}`}>
                  {t(STATUS_KEYS[s.status]?.label)}
                </span>
                {(s.status === "ACTIVE" || s.status === "OPEN") && (
                  <Link
                    href={`/session/${s.id}`}
                    className="rounded-md bg-lavender-400 px-2 py-1 text-xs font-medium text-void transition-colors hover:bg-lavender-500"
                  >
                    {t("session.enterRoom")}
                  </Link>
                )}
                {isGm && (
                  <StatusActions
                    status={s.status}
                    onChangeStatus={(newStatus) => handleStatusChange(s.id, newStatus)}
                  />
                )}

                {isGm && s.status === "CLOSED" && (
                  <>
                    {confirmDelete === s.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-400">{t("session.confirmDelete")}</span>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded bg-red-600 px-2 py-0.5 text-[10px] text-white hover:bg-red-700"
                        >
                          {t("common.delete")}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded border border-border px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200"
                        >
                          {t("common.giveUp")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        className="rounded-md bg-red-900/30 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-900/50"
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </>
                )}

                {!isGm && s.status === "CLOSED" && (
                  <button
                    onClick={() => handleLeave(s.id)}
                    className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-700"
                  >
                    {t("common.remove")}
                  </button>
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
  const { t } = useLocale();
  const transitions: Record<string, { label: TranslationKey; next: string }[]> = {
    OPEN: [{ label: "session.start", next: "ACTIVE" }],
    ACTIVE: [{ label: "session.closeRoom", next: "CLOSED" }],
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
          {t(a.label)}
        </button>
      ))}
    </>
  );
}
