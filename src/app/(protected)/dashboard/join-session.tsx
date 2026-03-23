"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale";

export function JoinSession() {
  const { t } = useLocale();
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
      setError(data.error || t("common.error"));
    }

    setLoading(false);
  }

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-gothic mb-4 text-lg font-semibold text-zinc-200">
        {t("join.title")}
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-2">
        {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
        <input
          name="inviteCode"
          type="text"
          placeholder={t("join.inviteCode")}
          required
          className="flex-1 rounded-md border border-border bg-void px-3 py-2 font-mono uppercase text-zinc-200 placeholder-zinc-500 transition-colors focus:border-lavender-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-lavender-400 px-4 py-2 font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
        >
          {loading ? "..." : t("common.join")}
        </button>
      </form>
    </div>
  );
}
