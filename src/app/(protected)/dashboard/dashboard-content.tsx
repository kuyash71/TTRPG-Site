"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Icon } from "@/components/icon";
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
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="min-h-screen bg-void p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="heading-gothic flex items-center gap-2 text-2xl font-bold text-lavender-400">
              <Icon name="logo" size={28} /> {t("dashboard.title")}
            </h1>
            <p className="text-zinc-400">
              {t("dashboard.welcome")}{" "}
              <span className="text-lavender-300">{username}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {role === "GM" || role === "ADMIN" ? (
              <span className="flex items-center gap-1 rounded bg-gold-900/30 px-3 py-1 text-xs font-medium text-gold-400">
                <Icon name="crown" size={14} /> {role}
              </span>
            ) : (
              <span className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                {role}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>

        {isGm && <GmPanel onCreated={() => setRefreshKey((k) => k + 1)} />}

        <SessionList isGm={isGm} refreshKey={refreshKey} />

        {!isGm && <JoinSession onJoined={() => setRefreshKey((k) => k + 1)} />}
      </div>
    </main>
  );
}
