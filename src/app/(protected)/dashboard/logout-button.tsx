"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-gray-700 px-3 py-1 text-xs font-medium text-gray-400 hover:border-red-500 hover:text-red-400"
    >
      Çıkış Yap
    </button>
  );
}
