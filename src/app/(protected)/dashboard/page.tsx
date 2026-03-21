import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const { user } = session;

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

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-200">
            Session&apos;larım
          </h2>
          <p className="text-sm text-gray-500">
            Henüz bir session&apos;a katılmadın. GM&apos;inden davet kodu iste.
          </p>
        </div>

        {(user.role === "GM" || user.role === "ADMIN") && (
          <div className="mt-6 rounded-lg border border-amber-900/50 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-amber-400">
              GM Paneli
            </h2>
            <p className="text-sm text-gray-500">
              Session oluşturma ve gameset editörü Sprint 2&apos;de aktif olacak.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
