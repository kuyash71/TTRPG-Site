import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignMembers, campaigns, invites } from "@/db/schema";
import { bad, conflict, notFound, route } from "@/lib/api";
import { requireCampaignGM } from "@/lib/access";
import { closeCampaignRoom } from "@/lib/realtime-bus";
import { LEVEL_CAP_MAX } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";

export const PATCH = route(
  {
    body: z.object({
      name: z.string().trim().min(2).max(80).optional(),
      contentKey: z.string().max(80).nullable().optional(),
      description: z.string().trim().max(2000).optional(),
      startPerkPoints: z.number().int().min(0).max(10).optional(),
      levelCap: z.number().int().min(1).max(LEVEL_CAP_MAX).optional(),
      deathSaveEnabled: z.boolean().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
    }),
  },
  async ({ params, body, user }) => {
    await requireCampaignGM(params.id, user);
    if (body.contentKey && !content().campaigns.some((c) => c.key === body.contentKey)) throw bad("Bilinmeyen kampanya.");
    await db.update(campaigns).set(body).where(eq(campaigns.id, params.id));
    return { ok: true };
  },
);

/**
 * Odayı kapatır: kampanya; karakterleri, sohbet ve zar geçmişiyle birlikte kalıcı olarak silinir.
 * Yalnızca GM yapabilir ve odada hiç oyuncu ya da izleyici kalmamış olmalı.
 * Güvenlik için kampanyanın adı birebir yazılır. Kullanılmamış davetler iptal edilir.
 */
export const DELETE = route({ body: z.object({ confirmName: z.string().max(120) }), limit: 30 }, async ({ params, body, user }) => {
  const campaign = await requireCampaignGM(params.id, user);
  if (body.confirmName.trim() !== campaign.name.trim()) throw bad("Onay için kampanyanın adını aynen yazmalısın.");
  await db.transaction(async (tx) => {
    // Satırı kilitle: aynı anda kodla katılan biri (üyelik eklemesi bu satırı bekler) kapatmayı atlatamaz.
    const [row] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, params.id)).for("update");
    if (!row) throw notFound("Kampanya bulunamadı.");
    const left = await tx
      .select({ role: campaignMembers.role, n: count() })
      .from(campaignMembers)
      .where(eq(campaignMembers.campaignId, params.id))
      .groupBy(campaignMembers.role);
    const players = left.find((r) => r.role === "PLAYER")?.n ?? 0;
    const spectators = left.find((r) => r.role === "SPECTATOR")?.n ?? 0;
    if (players + spectators > 0) {
      const who = [players && `${players} oyuncu`, spectators && `${spectators} izleyici`].filter(Boolean).join(" ve ");
      throw conflict(`Odayı kapatmak için önce tüm oyuncuları çıkarmalısın (${who} kaldı).`);
    }
    await tx
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.campaignId, params.id), isNull(invites.usedById), isNull(invites.revokedAt)));
    await tx.delete(campaigns).where(eq(campaigns.id, params.id));
  });
  closeCampaignRoom(params.id, campaign.name);
  return { ok: true };
});
