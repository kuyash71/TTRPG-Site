"use client";

import { SessionProvider } from "next-auth/react";
import { LocaleProvider } from "@/lib/locale";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>
  );
}
