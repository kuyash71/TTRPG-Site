"use client";

import { signOut } from "next-auth/react";
import { useLocale } from "@/lib/locale";

export function LogoutButton() {
  const { t } = useLocale();
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-border px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-red-500 hover:text-red-400"
    >
      {t("auth.logout")}
    </button>
  );
}
