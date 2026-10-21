import type { Metadata } from "next";
import { AuthBrand } from "@/components/auth-brand";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { NewPasswordForm } from "./new-password-form";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Yeni şifre") };
}

/** Sıfırlama koduyla girenlerin zorunlu şifre değiştirme ekranı. */
export default async function NewPasswordPage() {
  const user = await currentUser();
  if (!user) redirect("/giris");
  if (!user.mustChangePassword) redirect("/panel");
  return (
    <>
      <AuthBrand />
      <NewPasswordForm name={user.displayName} />
    </>
  );
}
