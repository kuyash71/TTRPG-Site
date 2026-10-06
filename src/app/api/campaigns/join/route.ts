import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignMembers, campaigns } from "@/db/schema";
import { ApiError, bad, route } from "@/lib/api";
import { hit } from "@/lib/auth/ratelimit";
import { normalizeCode } from "@/lib/codes";
import { notifyCampaign } from "@/lib/realtime-bus";

export const POST = route({ body: z.object({ code: z.string().trim().min(4).max(20) }), limit: 20 }, async ({ body, user }) => {
  if (!hit(`join:${user.id}`, 10, 10 * 60_000)) throw new ApiError(429, "Çok fazla deneme.");
  const n = normalizeCode(body.code);
  const code = `${n.slice(0, 4)}-${n.slice(4, 8)}`;
  const c = await db.query.campaigns.findFirst({ where: or(eq(campaigns.joinCode, code), eq(campaigns.spectatorCode, code)) });
  if (!c || c.status === "ARCHIVED") throw bad("Kod geçersiz.");
  const role = c.spectatorCode === code ? ("SPECTATOR" as const) : ("PLAYER" as const);
  if (c.gmId !== user.id) {
    // Zaten üyeyse rolü değişmez (izleyici kodu bir oyuncuyu izleyiciye düşürmez).
    try {
      await db.insert(campaignMembers).values({ campaignId: c.id, userId: user.id, role }).onConflictDoNothing();
    } catch (e) {
      // Bu sırada GM odayı kapattıysa (yabancı anahtar ihlali) kod artık geçersizdir.
      const code = (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23503") throw bad("Kod geçersiz.");
      throw e;
    }
    notifyCampaign(c.id, "members:changed", {});
  }
  return { id: c.id, role };
});
