import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import { SessionList } from "./session-list";
import { GmPanel } from "./gm-panel";
import { JoinSession } from "./join-session";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { user } = session;
  const isGm = user.role === "GM" || user.role === "ADMIN";

  return (
    <main className="min-h-screen bg-void p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="heading-gothic text-2xl font-bold text-lavender-400">
              Dashboard
            </h1>
            <p className="text-zinc-400">
              Hoş geldin,{" "}
              <span className="text-lavender-300">{user.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user.role === "GM" || user.role === "ADMIN" ? (
              <span className="rounded bg-gold-900/30 px-3 py-1 text-xs font-medium text-gold-400">
                {user.role}
              </span>
            ) : (
              <span className="rounded bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                {user.role}
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
