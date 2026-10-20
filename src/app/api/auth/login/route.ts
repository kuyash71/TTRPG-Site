import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { ApiError, route } from "@/lib/api";
import { destroyAllSessions, sha256 } from "@/lib/auth/core";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeCode } from "@/lib/codes";
import { recordAttempt, tooManyAttempts } from "@/lib/auth/ratelimit";
import { startSession } from "@/lib/auth/session";

const WINDOW = 15 * 60_000;
const GENERIC = "Kullanıcı adı veya şifre hatalı.";

/**
 * Hız sınırları (başarısız denemeler sayılır):
 *  - IP başına 30 / 15 dk
 *  - kullanıcı adı + IP başına 8 / 15 dk
 *  - kullanıcı adı başına (tüm IP'ler) 60 / 15 dk — dağıtık denemelere karşı tavan.
 * Tek bir IP'den hesabı kilitlemek mümkün değildir (IP sınırı tavanın altında kalır).
 * nginx ayrıca IP başına dakikada 10 isteğe izin verir.
 */
export const POST = route(
  {
    auth: "none",
    body: z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) }),
  },
  async ({ body, ip }) => {
    const uname = body.username.toLowerCase();
    if (
      (await tooManyAttempts(`ip:${ip}`, 30, WINDOW)) ||
      (await tooManyAttempts(`ui:${uname}:${ip}`, 8, WINDOW)) ||
      (await tooManyAttempts(`u:${uname}`, 60, WINDOW))
    )
      throw new ApiError(429, "Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.");

    const user = await db.query.users.findFirst({ where: eq(users.username, uname) });
    const ok = await verifyPassword(body.password, user?.passwordHash ?? null);
    // Şifre tutmadıysa: GM'in onayladığı tek kullanımlık sıfırlama kodu mu?
    let viaReset = false;
    if (user && !ok && !user.disabled) {
      const used = await db
        .update(passwordResets)
        .set({ status: "USED", usedAt: new Date(), codeHash: null })
        .where(
          and(
            eq(passwordResets.userId, user.id),
            eq(passwordResets.status, "APPROVED"),
            eq(passwordResets.codeHash, sha256(normalizeCode(body.password))),
            gt(passwordResets.codeExpiresAt, new Date()),
            isNull(passwordResets.usedAt),
          ),
        )
        .returning({ id: passwordResets.id });
      viaReset = used.length > 0;
    }
    if (!user || !(ok || viaReset) || user.disabled) {
      await recordAttempt(`ip:${ip}`);
      await recordAttempt(`ui:${uname}:${ip}`);
      await recordAttempt(`u:${uname}`);
      throw new ApiError(401, GENERIC);
    }
    if (viaReset) {
      // Eski oturumlar kapanır; yeni şifre belirlenene kadar yalnızca şifre ekranı açılır.
      await destroyAllSessions(user.id);
      await db.update(users).set({ mustChangePassword: true, lastLoginAt: sql`now()` }).where(eq(users.id, user.id));
    } else await db.update(users).set({ lastLoginAt: sql`now()` }).where(eq(users.id, user.id));
    await startSession(user.id);
    return { ok: true, mustChangePassword: viaReset || user.mustChangePassword };
  },
);
