import type { Metadata } from "next";
import { AuthBrand } from "@/components/auth-brand";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { ForgotForm } from "./forgot-form";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Şifremi unuttum") };
}

export default async function ForgotPage() {
  if (await currentUser()) redirect("/panel");
  return (
    <>
      <AuthBrand />
      <ForgotForm />
    </>
  );
}
