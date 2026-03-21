"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (res?.error) {
      setError("Email veya şifre hatalı.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-void p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        <h1 className="heading-gothic text-xl font-bold text-lavender-400">
          Giriş Yap
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
          name="password"
          type="password"
          placeholder="Şifre"
          required
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-zinc-200 placeholder-zinc-500 transition-colors focus:border-lavender-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-lavender-400 py-2 font-medium text-void transition-colors hover:bg-lavender-500 disabled:opacity-50"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

        <p className="text-center text-sm text-zinc-400">
          Hesabın yok mu?{" "}
          <a href="/register" className="text-lavender-400 hover:underline">
            Kayıt Ol
          </a>
        </p>
      </form>
    </main>
  );
}
