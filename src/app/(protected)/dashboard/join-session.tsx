"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinSession() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const inviteCode = formData.get("inviteCode") as string;

    const res = await fetch("/api/sessions/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });

    const data = await res.json();

    if (res.ok) {
      router.refresh();
    } else {
      setError(data.error || "Bir hata oluştu.");
    }

    setLoading(false);
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-200">
        Session&apos;a Katıl
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <input
          name="inviteCode"
          type="text"
          placeholder="Davet kodu"
          required
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 uppercase focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-amber-600 px-4 py-2 font-medium text-gray-100 hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "..." : "Katıl"}
        </button>
      </form>
    </div>
  );
}
