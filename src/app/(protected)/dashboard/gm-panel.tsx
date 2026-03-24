"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/locale";
import { Icon } from "@/components/icon";

interface GamesetData {
  id: string;
  name: string;
}

export function GmPanel({ onCreated }: { onCreated?: () => void }) {
  const { t } = useLocale();
  const [showForm, setShowForm] = useState(false);
  const [gamesets, setGamesets] = useState<GamesetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGamesetForm, setShowGamesetForm] = useState(false);

  const [deletingGameset, setDeletingGameset] = useState<GamesetData | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetch("/api/gamesets")
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(setGamesets)
      .catch(() => setGamesets([]));
  }, []);

  async function handleCreateGameset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/gamesets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("gamesetName") }),
    });
    if (res.ok) {
      const newGameset = await res.json();
      setGamesets((prev) => [newGameset, ...prev]);
      setShowGamesetForm(false);
    }
  }

  async function handleCreateSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        gamesetId: formData.get("gamesetId"),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setLoading(false);
      onCreated?.();
    } else {
      const data = await res.json();
      setError(data.error || t("common.error"));
      setLoading(false);
    }
  }

  async function handleDeleteGameset() {
    if (!deletingGameset) return;
    setDeleteLoading(true);
    setDeleteError("");
    const res = await fetch(`/api/gamesets/${deletingGameset.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: deleteConfirmName }),
    });
    if (res.ok) {
      setGamesets((prev) => prev.filter((g) => g.id !== deletingGameset.id));
      setDeletingGameset(null);
      setDeleteConfirmName("");
    } else {
      const data = await res.json();
      setDeleteError(data.error || t("gm.deleteFailed"));
    }
    setDeleteLoading(false);
  }

  return (
    <div className="mb-6 rounded-lg border border-gold-900/50 bg-surface p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="heading-gothic flex items-center gap-2 text-lg font-semibold text-gold-400">
          <Icon name="crown" size={20} /> {t("gm.panel")}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGamesetForm(!showGamesetForm)}
            className="flex items-center gap-1 rounded-md bg-gold-900/50 px-3 py-1 text-sm font-medium text-gold-400 transition-colors hover:bg-gold-900"
          >
            {showGamesetForm ? t("common.giveUp") : <><Icon name="plus" size={14} /> {t("gm.newGameset")}</>}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-md bg-gold-400 px-3 py-1 text-sm font-medium text-void transition-colors hover:bg-gold-500"
          >
            {showForm ? t("common.giveUp") : <><Icon name="plus" size={14} /> {t("gm.newRoom")}</>}
          </button>
        </div>
      </div>

      {showGamesetForm && !showForm && (
        <form onSubmit={handleCreateGameset} className="mb-4 flex gap-2">
          <input
            name="gamesetName"
            type="text"
            placeholder={t("gm.gamesetName")}
            required
            className="flex-1 rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-gold-400 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-gold-500"
          >
            {t("common.create")}
          </button>
        </form>
      )}

      {gamesets.length > 0 && (
        <div className="mb-4 space-y-2">
          <h3 className="text-xs font-medium text-zinc-500">{t("gm.yourGamesets")}</h3>
          {gamesets.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-md border border-border bg-void px-3 py-2"
            >
              <span className="text-sm text-zinc-300">{g.name}</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/gm/gamesets/${g.id}/edit`}
                  className="flex items-center gap-1 rounded bg-gold-900/50 px-2 py-0.5 text-xs font-medium text-gold-400 transition-colors hover:bg-gold-900"
                >
                  <Icon name="Editpen" size={12} /> {t("common.edit")}
                </Link>
                <button
                  onClick={() => { setDeletingGameset(g); setDeleteConfirmName(""); setDeleteError(""); }}
                  className="flex items-center gap-1 rounded bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/50"
                >
                  <Icon name="trash" size={12} /> {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deletingGameset && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 p-4">
          <h4 className="mb-2 text-sm font-semibold text-red-400">
            {t("gm.deleteGameset")}: {deletingGameset.name}
          </h4>
          <p className="mb-3 text-xs text-zinc-400">
            {t("gm.deleteGamesetWarning")}
          </p>
          <input
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={deletingGameset.name}
            className="mb-2 w-full rounded-md border border-red-900/50 bg-void px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-red-500 focus:outline-none"
          />
          {deleteError && (
            <p className="mb-2 text-xs text-red-400">{deleteError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteGameset}
              disabled={deleteConfirmName !== deletingGameset.name || deleteLoading}
              className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-30"
            >
              {deleteLoading ? t("gm.deleting") : t("gm.deletePermanently")}
            </button>
            <button
              onClick={() => setDeletingGameset(null)}
              className="rounded-md border border-border px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              {t("common.giveUp")}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreateSession} className="space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <input
            name="name"
            type="text"
            placeholder={t("gm.roomName")}
            required
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
          />
          {gamesets.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("gm.createGamesetFirst")}</p>
          ) : (
            <select
              name="gamesetId"
              required
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 transition-colors focus:border-gold-400 focus:outline-none"
            >
              <option value="">{t("gm.selectGameset")}</option>
              {gamesets.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={loading || gamesets.length === 0}
            className="w-full rounded-md bg-gold-400 py-2 font-medium text-void transition-colors hover:bg-gold-500 disabled:opacity-50"
          >
            {loading ? t("gm.creating") : t("gm.createRoom")}
          </button>
        </form>
      )}
    </div>
  );
}
