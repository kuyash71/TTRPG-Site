import type { Metadata } from "next";
import { AuthBrand } from "@/components/auth-brand";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Hesap oluştur" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  if (await currentUser()) redirect("/panel");
  const { kod } = await searchParams;
  return (
    <>
      <AuthBrand />
      <RegisterForm code={(kod ?? "").slice(0, 40)} />
    </>
  );
}
