import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { STAT_KEYS, STAT_LABELS, STAT_MAX } from "@/lib/shz/constants";

export const POST = route({ body: z.object({ stat: z.enum(STAT_KEYS) }), limit: 30 }, async ({ params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "SHZ");
  if (c.freeStatPoints < 1) throw bad("Serbest stat puanın yok.");
  if (c.stats[body.stat] >= STAT_MAX) throw bad("{stat} zaten {max}.", { stat: STAT_LABELS[body.stat], max: STAT_MAX });
  const upd = await db
    .update(characters)
    .set({ stats: { ...c.stats, [body.stat]: c.stats[body.stat] + 1 }, freeStatPoints: c.freeStatPoints - 1 })
    .where(and(eq(characters.id, c.id), eq(characters.freeStatPoints, c.freeStatPoints)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  await addLog(c.id, user.id, "stat", fmt("Serbest puan: {stat} {from} → {to}", { stat: STAT_LABELS[body.stat], from: c.stats[body.stat], to: c.stats[body.stat] + 1 }));
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
