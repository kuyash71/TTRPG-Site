"use client";

import { useLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LogoutButton } from "./logout-button";
import { SessionList } from "./session-list";
import { GmPanel } from "./gm-panel";
import { JoinSession } from "./join-session";

interface Props {
  username: string;
  role: string;
  isGm: boolean;
}

export function DashboardContent({ username, role, isGm }: Props) {
  const { t } = useLocale();

  return (
    <main className="min-h-screen bg-void p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="heading-gothic text-2xl font-bold text-lavender-400">
              {t("dashboard.title")}
            </h1>
            <p className="text-zinc-400">
              {t("dashboard.welcome")}{" "}
              <span className="text-lavender-300">{username}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {role === "GM" || role === "ADMIN" ? (
              <span className="rounded bg-gold-900/30 px-3 py-1 text-xs font-medium text-gold-400">
                {role}
              </span>
            ) : (
              <span className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                {role}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>

        {isGm && <GmPanel />}

        <SessionList isGm={isGm} />

        {!isGm && <JoinSession />}
      </div>
    </main>
  );
}
