import { and, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { ApiError, route } from "@/lib/api";
import { recordAttempt, tooManyAttempts } from "@/lib/auth/ratelimit";
import { resetApproverIds } from "@/lib/password-resets";
import { notifyUser } from "@/lib/realtime-bus";

const HOUR = 60 * 60_000;

/**
 * "Şifremi unuttum": kullanıcı adıyla istek bırakır. Hesabın var olup olmadığı cevaptan anlaşılmaz.
 * İstek, kullanıcının kampanyalarının GM'lerine ve site yöneticisine düşer; onaylayan tek kullanımlık kodu oyuncuya iletir.
 */
export const POST = route({ auth: "none", body: z.object({ username: z.string().trim().min(1).max(40) }), limit: 10 }, async ({ body, ip }) => {
  const uname = body.username.toLowerCase();
  if ((await tooManyAttempts(`fp-ip:${ip}`, 6, HOUR)) || (await tooManyAttempts(`fp-u:${uname}`, 3, HOUR)))
    throw new ApiError(429, "Çok fazla istek. Bir saat sonra tekrar dene.");
  await recordAttempt(`fp-ip:${ip}`);
  await recordAttempt(`fp-u:${uname}`);
  const user = await db.query.users.findFirst({ where: eq(users.username, uname), columns: { id: true, disabled: true, displayName: true } });
  if (user && !user.disabled) {
    const open = await db
      .select({ id: passwordResets.id })
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.userId, user.id),
          or(eq(passwordResets.status, "PENDING"), and(eq(passwordResets.status, "APPROVED"), gt(passwordResets.codeExpiresAt, new Date()))),
        ),
      )
      .limit(1);
    if (!open.length) {
      await db.insert(passwordResets).values({ userId: user.id, ip: ip.slice(0, 64) });
      for (const id of await resetApproverIds(user.id)) notifyUser(id, "reset:request", { name: user.displayName });
    }
  }
  return { ok: true };
});

