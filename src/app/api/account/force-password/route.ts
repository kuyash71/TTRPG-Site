import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { bad, route } from "@/lib/api";
import { destroyAllSessions } from "@/lib/auth/core";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";

/** Sıfırlama koduyla giren kullanıcının zorunlu yeni şifresi (mevcut şifre sorulmaz). */
export const POST = route({ body: z.object({ next: z.string().max(200) }), limit: 10, allowMustChange: true }, async ({ body, user }) => {
  if (!user.mustChangePassword) throw bad("Şifreni Hesap sayfasından değiştirebilirsin.");
  const p = passwordProblem(body.next, user.username);
  if (p) throw bad(p);
  await db.update(users).set({ passwordHash: await hashPassword(body.next), mustChangePassword: false }).where(eq(users.id, user.id));
  await destroyAllSessions(user.id);
  await startSession(user.id);
  return { ok: true };
});
