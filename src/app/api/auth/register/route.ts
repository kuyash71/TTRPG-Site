import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignMembers, campaigns, invites, users } from "@/db/schema";
import { ApiError, bad, conflict, route } from "@/lib/api";
import { sha256 } from "@/lib/auth/core";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { recordAttempt, tooManyAttempts } from "@/lib/auth/ratelimit";
import { startSession } from "@/lib/auth/session";
import { badLoose } from "@/lib/api-loose";
import { normalizeCode } from "@/lib/codes";

export const POST = route(
  {
    auth: "none",
    body: z.object({
      code: z.string().trim().min(10).max(40),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_.-]{3,24}$/, "3–24 karakter; harf, rakam, _ . - kullanılabilir"),
      displayName: z.string().trim().min(2).max(40),
      password: z.string().max(200),
    }),
  },
  async ({ req, body, ip }) => {
    if (await tooManyAttempts(`reg:${ip}`, 10, 60 * 60_000)) throw new ApiError(429, "Çok fazla deneme. Bir saat sonra tekrar dene.");
    await recordAttempt(`reg:${ip}`);

    const pw = passwordProblem(body.password, body.username);
    if (pw) throw badLoose(req, pw);

    const codeHash = sha256(normalizeCode(body.code));
    const invite = await db.query.invites.findFirst({
      where: and(eq(invites.codeHash, codeHash), isNull(invites.usedById), isNull(invites.revokedAt), gt(invites.expiresAt, new Date())),
    });
    if (!invite) throw bad("Davet kodu geçersiz, kullanılmış veya süresi dolmuş.");

    const exists = await db.query.users.findFirst({ where: eq(users.username, body.username) });
    if (exists) throw conflict("Bu kullanıcı adı alınmış.");

    const passwordHash = await hashPassword(body.password);
    const userId = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ username: body.username, displayName: body.displayName, passwordHash, role: invite.role })
        .returning({ id: users.id });
      const used = await tx
        .update(invites)
        .set({ usedById: u.id, usedAt: new Date() })
        .where(and(eq(invites.id, invite.id), isNull(invites.usedById)))
        .returning({ id: invites.id });
      if (!used.length) throw conflict("Bu davet az önce kullanıldı.");
      if (invite.campaignId) await tx.insert(campaignMembers).values({ campaignId: invite.campaignId, userId: u.id, role: invite.memberRole }).onConflictDoNothing();
      return u.id;
    });
    await startSession(userId);
    // Davet bir Umbra Caelis kampanyasına bağlıysa oyuncu o sistemin paneline gider.
    const camp = invite.campaignId ? await db.query.campaigns.findFirst({ where: eq(campaigns.id, invite.campaignId), columns: { system: true } }) : null;
    return { ok: true, system: camp?.system ?? "SHZ" };
  },
);
