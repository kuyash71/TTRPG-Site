"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

interface GamesetData {
  id: string;
  name: string;
}

export function GmPanel() {
  const [showForm, setShowForm] = useState(false);
  const [gamesets, setGamesets] = useState<GamesetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showGamesetForm, setShowGamesetForm] = useState(false);

  // Gameset delete state
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
      window.location.reload();
    } else {
      const data = await res.json();
      setError(data.error || "Bir hata olustu.");
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
      setDeleteError(data.error || "Silinemedi.");
    }
    setDeleteLoading(false);
  }

  return (
    <div className="mb-6 rounded-lg border border-gold-900/50 bg-surface p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="heading-gothic text-lg font-semibold text-gold-400">
          GM Paneli
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGamesetForm(!showGamesetForm)}
            className="rounded-md bg-gold-900/50 px-3 py-1 text-sm font-medium text-gold-400 transition-colors hover:bg-gold-900"
          >
            {showGamesetForm ? "Vazgec" : "Yeni Gameset"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-gold-400 px-3 py-1 text-sm font-medium text-void transition-colors hover:bg-gold-500"
          >
            {showForm ? "Vazgec" : "Yeni Oda"}
          </button>
        </div>
      </div>

      {/* Yeni Gameset formu */}
      {showGamesetForm && !showForm && (
        <form onSubmit={handleCreateGameset} className="mb-4 flex gap-2">
          <input
            name="gamesetName"
            type="text"
            placeholder="Gameset adi"
            required
            className="flex-1 rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-gold-400 px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-gold-500"
          >
            Olustur
          </button>
        </form>
      )}

      {/* Gameset listesi */}
      {gamesets.length > 0 && (
        <div className="mb-4 space-y-2">
          <h3 className="text-xs font-medium text-zinc-500">Gameset&apos;lerin</h3>
          {gamesets.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-md border border-border bg-void px-3 py-2"
            >
              <span className="text-sm text-zinc-300">{g.name}</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/gm/gamesets/${g.id}/edit`}
                  className="rounded bg-gold-900/50 px-2 py-0.5 text-xs font-medium text-gold-400 transition-colors hover:bg-gold-900"
                >
                  Duzenle
                </Link>
                <button
                  onClick={() => { setDeletingGameset(g); setDeleteConfirmName(""); setDeleteError(""); }}
                  className="rounded bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/50"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gameset silme onay dialog */}
      {deletingGameset && (
        <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/20 p-4">
          <h4 className="mb-2 text-sm font-semibold text-red-400">
            Gameset Sil: {deletingGameset.name}
          </h4>
          <p className="mb-3 text-xs text-zinc-400">
            Bu islem geri alinamaz. Gameset&apos;e bagli tum kapatilmis odalar, karakterler
            ve veriler kalici olarak silinecektir. Onaylamak icin gameset adini yazin:
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
              {deleteLoading ? "Siliniyor..." : "Kalici Olarak Sil"}
            </button>
            <button
              onClick={() => setDeletingGameset(null)}
              className="rounded-md border border-border px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Vazgec
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
            placeholder="Oda adi"
            required
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
          />

          {gamesets.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Once bir gameset olusturun.
            </p>
          ) : (
            <select
              name="gamesetId"
              required
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 transition-colors focus:border-gold-400 focus:outline-none"
            >
              <option value="">Gameset sec...</option>
              {gamesets.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            disabled={loading || gamesets.length === 0}
            className="w-full rounded-md bg-gold-400 py-2 font-medium text-void transition-colors hover:bg-gold-500 disabled:opacity-50"
          >
            {loading ? "Olusturuluyor..." : "Oda Olustur"}
          </button>
        </form>
      )}
    </div>
  );
}
