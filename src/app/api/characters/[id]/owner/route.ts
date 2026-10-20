import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { campaignMembers, characters, users } from "@/db/schema";
import { bad, conflict, forbidden, route, zId } from "@/lib/api";
import { addLog, characterAccess } from "@/lib/access";
import { characterChanged, notifyCampaign } from "@/lib/realtime-bus";

/**
 * GM karakteri bir oyuncuya ya da kendisine devreder veya sahipsiz bırakır (userId: null).
 * Oyuncular kampanya başına tek aktif/onay bekleyen karaktere sahip olabilir; GM sınırsız.
 */
export const PATCH = route({ body: z.object({ userId: zId.nullable() }), limit: 30 }, async ({ params, body, user }) => {
  const a = await characterAccess(params.id, user);
  if (!a.isGM) throw forbidden("Karakteri yalnızca GM devredebilir.");
  const c = a.character;
  if (body.userId === c.userId) return { ok: true };
  let targetName = "sahipsiz";
  if (body.userId) {
    const target = await db.query.users.findFirst({ where: eq(users.id, body.userId), columns: { id: true, displayName: true } });
    if (!target) throw bad("Kullanıcı bulunamadı.");
    targetName = target.displayName;
    if (target.id !== a.campaign.gmId) {
      const m = await db.query.campaignMembers.findFirst({
        where: and(eq(campaignMembers.campaignId, a.campaign.id), eq(campaignMembers.userId, target.id)),
      });
      if (!m) throw bad("Bu kullanıcı kampanyada değil.");
      if (m.role === "SPECTATOR") throw bad("İzleyicilere karakter devredilemez. Önce oyuncu yap.");
    }
  }
  await db.transaction(async (tx) => {
    if (body.userId && body.userId !== a.campaign.gmId) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${a.campaign.id + ":" + body.userId}))`);
      if (c.status === "ACTIVE" || c.status === "PENDING") {
        const other = await tx
          .select({ id: characters.id, name: characters.name })
          .from(characters)
          .where(
            and(
              eq(characters.campaignId, a.campaign.id),
              eq(characters.userId, body.userId),
              inArray(characters.status, ["ACTIVE", "PENDING"]),
              ne(characters.id, c.id),
            ),
          )
          .limit(1);
        if (other.length) throw conflict(`${targetName} bu kampanyada zaten aktif bir karaktere sahip (${other[0].name}). Önce onu devret ya da emekliye ayır.`);
      }
    }
    await tx.update(characters).set({ userId: body.userId }).where(eq(characters.id, c.id));
  });
  await addLog(c.id, user.id, "gm", `GM: karakter ${body.userId ? `${targetName} oyuncusuna devredildi` : "sahipsiz bırakıldı"}`);
  characterChanged(a.campaign.id, c.id);
  notifyCampaign(a.campaign.id, "approvals:changed", {});
  return { ok: true };
});
