import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getT } from "@/i18n/server";
import { pageUser } from "@/lib/auth/session";
import { AccountForms } from "./account-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Hesap") };
}

export default async function AccountPage() {
  const user = await pageUser();
  const t = await getT();
  return (
    <div className="max-w-2xl">
      <PageHeader kicker={t("Hesap")} title={user.displayName}>
        @{user.username} · {user.role === "GM" ? "GM" : t("Oyuncu")}
      </PageHeader>
      <AccountForms />
    </div>
  );
}
