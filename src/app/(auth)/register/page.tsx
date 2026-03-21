"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body = {
      email: formData.get("email"),
      username: formData.get("username"),
      password: formData.get("password"),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Bir hata oluştu.");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-void p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="heading-gothic text-xl font-bold text-lavender-400">
          Kayıt Ol
        </h1>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-lavender-400 focus:outline-none"
        />
        <input
          name="username"
          type="text"
          placeholder="Kullanıcı Adı"
          required
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-lavender-400 focus:outline-none"
        />
        <input
          name="password"
          type="password"
          placeholder="Şifre (min 6 karakter)"
          required
          minLength={6}
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-lavender-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-lavender-400 py-2 font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
        >
          {loading ? "Kaydediliyor..." : "Kayıt Ol"}
        </button>

        <p className="text-center text-sm text-zinc-400">
          Zaten hesabın var mı?{" "}
          <a href="/login" className="text-lavender-400 hover:underline">
            Giriş Yap
          </a>
        </p>
      </form>
    </main>
  );
}
