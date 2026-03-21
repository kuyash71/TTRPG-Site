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
    <main className="min-h-screen bg-gray-950 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-gray-400">
              Hoş geldin, <span className="text-amber-500">{user.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-gray-800 px-3 py-1 text-xs font-medium text-amber-400">
              {user.role}
            </span>
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
