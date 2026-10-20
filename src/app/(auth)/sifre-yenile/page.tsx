import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Yeni şifre" };

/** Sıfırlama koduyla girenlerin zorunlu şifre değiştirme ekranı. */
export default async function NewPasswordPage() {
  const user = await currentUser();
  if (!user) redirect("/giris");
  if (!user.mustChangePassword) redirect("/panel");
  return <NewPasswordForm name={user.displayName} />;
}
