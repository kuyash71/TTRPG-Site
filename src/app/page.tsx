"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function Home() {
  const { t } = useLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-8">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="text-center">
        <img src="/icons/ui/logo.svg" alt="Umbra Caelis" className="mx-auto mb-4 h-20 w-20" />
        <h1 className="heading-gothic mb-2 text-4xl font-bold text-lavender-400">
          Umbra Caelis
        </h1>
        <p className="mb-8 font-body text-zinc-400">
          {t("home.tagline")}
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-lavender-400 px-6 py-2 font-medium text-void transition-colors hover:bg-lavender-500"
          >
            {t("auth.login")}
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-border px-6 py-2 font-medium text-zinc-300 transition-colors hover:border-lavender-400 hover:text-lavender-400"
          >
            {t("auth.register")}
          </Link>
        </div>
      </div>
    </main>
  );
}
