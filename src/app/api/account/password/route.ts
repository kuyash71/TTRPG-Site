import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { bad, route } from "@/lib/api";
import { destroyAllSessions } from "@/lib/auth/core";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { badLoose } from "@/lib/api-loose";

export const POST = route(
  { body: z.object({ current: z.string().max(200), next: z.string().max(200) }), limit: 10 },
  async ({ req, body, user }) => {
    const u = await db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!u || !(await verifyPassword(body.current, u.passwordHash))) throw bad("Mevcut şifre hatalı.");
    const p = passwordProblem(body.next, u.username);
    if (p) throw badLoose(req, p);
    await db.update(users).set({ passwordHash: await hashPassword(body.next) }).where(eq(users.id, u.id));
    await destroyAllSessions(u.id);
    await startSession(u.id);
    return { ok: true };
  },
);
