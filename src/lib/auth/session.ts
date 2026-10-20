import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isProd } from "../env";
import { SESSION_COOKIE, createSession, destroySessionByToken, userFromToken, type SessionUser } from "./core";

export type { SessionUser };

/** Geçerli isteğin kullanıcısı (istek başına bir kez sorgulanır). */
export const currentUser = cache(async () => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});

/** Sayfalar için: giriş yoksa giriş sayfasına yönlendirir. */
export async function pageUser(opts?: { next?: string }) {
  const u = await currentUser();
  if (!u) redirect(opts?.next ? `/giris?sonra=${encodeURIComponent(opts.next)}` : "/giris");
  // Sıfırlama koduyla girenler önce yeni şifre belirler.
  if (u.mustChangePassword) redirect("/sifre-yenile");
  return u;
}
export async function pageGM() {
  const u = await pageUser();
  if (u.role !== "GM") redirect("/panel");
  return u;
}

export async function clientMeta() {
  const h = await headers();
  return { ip: clientIp(h), userAgent: h.get("user-agent") };
}

/** nginx, Cloudflare'in gerçek IP başlığını X-Real-IP olarak iletir (deploy/nginx.conf). */
export function clientIp(h: Headers): string {
  return (h.get("x-real-ip") || "").trim().slice(0, 64) || "yerel";
}

/**
 * Tam adrese yönlendirme. /umbracaelis gibi uygulama alt yolunun (basePath) dışındaki adresler için:
 * redirect() göreli yola /schwarzesonne ekler.
 */
export async function absoluteRedirect(path: string): Promise<never> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (isProd ? "https" : "http");
  redirect(`${proto}://${host}${path}`);
}

export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(userId, await clientMeta());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await destroySessionByToken(t);
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
}
