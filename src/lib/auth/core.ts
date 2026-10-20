// Oturum çekirdeği: Next.js'e bağımlı değildir, socket sunucusu da kullanır.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db";
import { sessions, users, type User } from "../../db/schema";

/**
 * Oturum çerezi. Yol "/" olduğu için hem /schwarzesonne hem /umbracaelis altında geçerlidir (tek hesap, iki sistem).
 * Eski sürümün çerezi ("shz_session", yalnızca /schwarzesonne yolu) ara katmanda bu ada taşınır.
 */
export const SESSION_COOKIE = "shz_sid";
export const LEGACY_SESSION_COOKIE = "shz_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 gün
const TOUCH_INTERVAL_MS = 1000 * 60 * 30;

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export type SessionUser = Pick<User, "id" | "username" | "displayName" | "role" | "isAdmin" | "mustChangePassword">;

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt,
    ip: meta.ip?.slice(0, 64) ?? null,
    userAgent: meta.userAgent?.slice(0, 256) ?? null,
  });
  return { token, expiresAt };
}

/** Ham çerez token'ından kullanıcıyı bulur. Süresi dolmuş veya devre dışı hesaplar için null döner. */
export async function userFromToken(token: string | undefined | null): Promise<(SessionUser & { sessionId: string }) | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const rows = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isAdmin: users.isAdmin,
      mustChangePassword: users.mustChangePassword,
      disabled: users.disabled,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const r = rows[0];
  if (!r || r.disabled) return null;
  if (Date.now() - r.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // Kayan süre: aktif oturumun ömrünü uzat.
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, r.sessionId));
  }
  return { sessionId: r.sessionId, id: r.id, username: r.username, displayName: r.displayName, role: r.role, isAdmin: r.isAdmin, mustChangePassword: r.mustChangePassword };
}

export async function destroySessionByToken(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function destroyAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  disconnectUserSockets(userId);
}

/** Kullanıcının açık oyun odası bağlantılarını hemen keser (aynı süreçteki Socket.io). */
export function disconnectUserSockets(userId: string) {
  (globalThis as { __shzIO?: { in(r: string): { disconnectSockets(close?: boolean): void } } }).__shzIO?.in(`user:${userId}`).disconnectSockets(true);
}

/** Basit çerez ayrıştırıcı (socket el sıkışması için). */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
