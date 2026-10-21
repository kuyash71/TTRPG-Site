import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { asUcChar, ucStatsColumn } from "@/lib/uc/char";
import { UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import { UC_STAT_MAX } from "@/lib/uc/rules";

export const POST = route({ body: z.object({ stat: z.enum(UC_STAT_KEYS) }), limit: 30 }, async ({ params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "UC");
  if (c.freeStatPoints < 1) throw bad("Serbest stat puanın yok.");
  const stats = asUcChar(c).stats;
  if (stats[body.stat] >= UC_STAT_MAX) throw bad("{stat} zaten {max}.", { stat: UC_STAT_LABELS[body.stat], max: UC_STAT_MAX });
  const before = stats[body.stat];
  stats[body.stat]++;
  const upd = await db
    .update(characters)
    .set({ stats: ucStatsColumn(stats), freeStatPoints: c.freeStatPoints - 1 })
    .where(and(eq(characters.id, c.id), eq(characters.freeStatPoints, c.freeStatPoints)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  await addLog(c.id, user.id, "stat", fmt("Serbest puan: {stat} {from} → {to}", { stat: UC_STAT_LABELS[body.stat], from: before, to: before + 1 }));
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
