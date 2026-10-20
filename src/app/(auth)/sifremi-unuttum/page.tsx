import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default async function ForgotPage() {
  if (await currentUser()) redirect("/panel");
  return <ForgotForm />;
}
