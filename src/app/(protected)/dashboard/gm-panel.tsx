"use client";

import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
    fetch("/api/gamesets")
      .then((res) => res.json())
      .then(setGamesets);
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
      setError(data.error || "Bir hata oluştu.");
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-gold-900/50 bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="heading-gothic text-lg font-semibold text-gold-400">
          GM Paneli
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-gold-400 px-3 py-1 text-sm font-medium text-void transition-colors hover:bg-gold-500"
        >
          {showForm ? "Vazgeç" : "Yeni Session"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateSession} className="space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <input
            name="name"
            type="text"
            placeholder="Session adı"
            required
            className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
          />

          {gamesets.length === 0 && !showGamesetForm ? (
            <div className="rounded-md border border-border bg-void p-3">
              <p className="mb-2 text-sm text-zinc-400">
                Henüz bir gameset&apos;in yok.
              </p>
              <button
                type="button"
                onClick={() => setShowGamesetForm(true)}
                className="text-sm text-gold-400 hover:underline"
              >
                Hızlı Gameset Oluştur
              </button>
            </div>
          ) : showGamesetForm ? (
            <div className="rounded-md border border-border bg-void p-3">
              <form onSubmit={handleCreateGameset} className="flex gap-2">
                <input
                  name="gamesetName"
                  type="text"
                  placeholder="Gameset adı"
                  required
                  className="flex-1 rounded-md border border-border bg-surface-raised px-2 py-1 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-gold-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md bg-gold-400 px-3 py-1 text-sm text-void transition-colors hover:bg-gold-500"
                >
                  Oluştur
                </button>
              </form>
            </div>
          ) : (
            <select
              name="gamesetId"
              required
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 transition-colors focus:border-gold-400 focus:outline-none"
            >
              <option value="">Gameset seç...</option>
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
            {loading ? "Oluşturuluyor..." : "Session Oluştur"}
          </button>
        </form>
      )}
    </div>
  );
}
