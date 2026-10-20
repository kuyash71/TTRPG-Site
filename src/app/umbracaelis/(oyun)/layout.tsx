import { RoomReturn } from "@/components/room-return";
import { UcAppNav } from "@/components/uc/app-nav";
import { pageUser } from "@/lib/auth/session";
import { pendingResetCount } from "@/lib/password-resets";

/** Umbra Caelis oyun bölümü: panel, kampanyalar, karakterler, oyun odası. Hesap Schwarzesonne ile ortaktır. */
export default async function UcGameLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser({ next: "/umbracaelis/panel" });
  const resets = await pendingResetCount(user);
  return (
    <>
      <UcAppNav user={user} resets={resets} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <RoomReturn />
    </>
  );
}
