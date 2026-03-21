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

  // Gameset yoksa inline oluşturma
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
    <div className="mb-6 rounded-lg border border-amber-900/50 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-amber-400">GM Paneli</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-amber-600 px-3 py-1 text-sm font-medium text-gray-100 hover:bg-amber-500"
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
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
          />

          {gamesets.length === 0 && !showGamesetForm ? (
            <div className="rounded border border-gray-700 bg-gray-800 p-3">
              <p className="mb-2 text-sm text-gray-400">
                Henüz bir gameset&apos;in yok.
              </p>
              <button
                type="button"
                onClick={() => setShowGamesetForm(true)}
                className="text-sm text-amber-500 hover:underline"
              >
                Hızlı Gameset Oluştur
              </button>
            </div>
          ) : showGamesetForm ? (
            <div className="rounded border border-gray-700 bg-gray-800 p-3">
              <form onSubmit={handleCreateGameset} className="flex gap-2">
                <input
                  name="gamesetName"
                  type="text"
                  placeholder="Gameset adı"
                  required
                  className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-amber-600 px-3 py-1 text-sm text-gray-100 hover:bg-amber-500"
                >
                  Oluştur
                </button>
              </form>
            </div>
          ) : (
            <select
              name="gamesetId"
              required
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 focus:border-amber-500 focus:outline-none"
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
            className="w-full rounded bg-amber-600 py-2 font-medium text-gray-100 hover:bg-amber-500 disabled:opacity-50"
          >
            {loading ? "Oluşturuluyor..." : "Session Oluştur"}
          </button>
        </form>
      )}
    </div>
  );
}
