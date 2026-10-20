import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { absoluteRedirect, currentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

/** Yalnızca site içi yollara yönlendir (açık yönlendirme engeli). */
function safeNext(sonra: string | undefined) {
  return sonra && /^\/[a-zA-Z0-9/_\-#?=&]*$/.test(sonra) && !sonra.startsWith("//") ? sonra : "/panel";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sonra?: string }> }) {
  const { sonra } = await searchParams;
  const next = safeNext(sonra);
  const user = await currentUser();
  if (user) {
    if (user.mustChangePassword) redirect("/sifre-yenile");
    if (next.startsWith("/umbracaelis")) await absoluteRedirect(next);
    redirect(next);
  }
  return <LoginForm next={next} />;
}
