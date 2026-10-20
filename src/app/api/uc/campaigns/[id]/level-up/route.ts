import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters, messages } from "@/db/schema";
import { bad, route, zId } from "@/lib/api";
import { requireCampaignGM, requireSystem } from "@/lib/access";
import { notifyCampaign } from "@/lib/realtime-bus";
import { asUcChar, ucStatsColumn, ucUnspent } from "@/lib/uc/char";
import { UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import { ucRulesData } from "@/lib/uc/content";
import { UC_STAT_MAX, ucDalOfTier, ucTierOfLevel } from "@/lib/uc/rules";

const zStat = z.enum(UC_STAT_KEYS);

/**
 * Umbra Caelis toplu seviye atlatma (Core: her seviyede 2 + 1 stat, katmanında 1 yetenek puanı).
 *  - aksiyon stat'ı +1 (GM seçer)
 *  - sembol stat +1: puanın kazanıldığı katmandaki dalın stat'ı (dal henüz seçilmediyse dal seçilince eklenir; 10 ise serbest puan)
 *  - MVP +1 (seviye atlayanlardan biri)
 */
export const POST = route(
  {
    body: z.object({
      entries: z.array(z.object({ characterId: zId, actionStat: zStat })).min(1).max(20),
      mvp: z.object({ characterId: zId, stat: zStat }).nullable(),
    }),
  },
  async ({ params, body, user }) => {
    const camp = await requireCampaignGM(params.id, user);
    requireSystem(camp, "UC");
    const data = ucRulesData();
    const ids = body.entries.map((e) => e.characterId);
    if (new Set(ids).size !== ids.length) throw bad("Aynı karakter iki kez seçilmiş.");
    if (body.mvp && !ids.includes(body.mvp.characterId)) throw bad("MVP, seviye atlayanlardan biri olmalı.");

    const plans = await db.transaction(async (tx) => {
      const chars = await tx
        .select()
        .from(characters)
        .where(and(eq(characters.campaignId, camp.id), inArray(characters.id, ids)))
        .for("update");
      if (chars.length !== ids.length) throw bad("Karakterlerden biri bu kampanyada değil.");
      const plans = body.entries.map((e) => {
        const c = chars.find((x) => x.id === e.characterId)!;
        if (c.status !== "ACTIVE") throw bad(`${c.name} aktif değil.`);
        if (c.level >= camp.levelCap) throw bad(`${c.name} seviye sınırında (${camp.levelCap}).`);
        const ch = asUcChar(c);
        const stats = { ...ch.stats };
        const notes: string[] = [];
        let free = 0;
        let pending = c.uc?.pendingSymbol ?? 0;
        const newLevel = c.level + 1;
        const tier = ucTierOfLevel(newLevel);
        const dal = ucDalOfTier(ch, tier, data);
        if (dal) {
          if (stats[dal.stat] < UC_STAT_MAX) {
            stats[dal.stat]++;
            notes.push(`${UC_STAT_LABELS[dal.stat]} +1 (sembol)`);
          } else {
            free++;
            notes.push("sembol stat 10 olduğu için +1 serbest puan");
          }
        } else {
          pending++;
          notes.push(`K${tier} dalı seçilince sembol stat +1`);
        }
        if (stats[e.actionStat] >= UC_STAT_MAX) throw bad(`${c.name}: ${UC_STAT_LABELS[e.actionStat]} zaten ${UC_STAT_MAX}. Başka bir aksiyon stat'ı seç.`);
        stats[e.actionStat]++;
        notes.push(`${UC_STAT_LABELS[e.actionStat]} +1 (aksiyon)`);
        if (body.mvp?.characterId === c.id) {
          if (stats[body.mvp.stat] >= UC_STAT_MAX) throw bad(`${c.name}: MVP için seçilen ${UC_STAT_LABELS[body.mvp.stat]} zaten ${UC_STAT_MAX}.`);
          stats[body.mvp.stat]++;
          notes.push(`${UC_STAT_LABELS[body.mvp.stat]} +1 (MVP)`);
        }
        if (newLevel === 5 || newLevel === 10) notes.push(`K${tier} açıldı`);
        if (newLevel === 15) notes.push("Zirve: 1 serbest yetenek puanı");
        return { c, stats, free, pending, newLevel, notes };
      });
      for (const p of plans) {
        await tx
          .update(characters)
          .set({
            level: p.newLevel,
            abilityPoints: ucUnspent({ level: p.newLevel, abilities: p.c.abilities }, data),
            freeStatPoints: sql`${characters.freeStatPoints} + ${p.free}`,
            stats: ucStatsColumn(p.stats),
            uc: { ...p.c.uc, pendingSymbol: p.pending },
          })
          .where(eq(characters.id, p.c.id));
        await tx.insert(characterLogs).values({ characterId: p.c.id, actorId: user.id, kind: "level-up", text: `Seviye ${p.c.level} → ${p.newLevel}: +1 yetenek puanı, ${p.notes.join(", ")}` });
      }
      await tx.insert(messages).values({
        campaignId: camp.id,
        userId: user.id,
        channel: "SYSTEM",
        content: `Seviye atlayanlar: ${plans.map((p) => `${p.c.name} (Sv ${p.newLevel})`).join(", ")}${body.mvp ? ` · MVP: ${plans.find((p) => p.c.id === body.mvp!.characterId)!.c.name}` : ""}`,
      });
      return plans;
    });
    for (const p of plans) notifyCampaign(camp.id, "character:changed", { characterId: p.c.id });
    notifyCampaign(camp.id, "messages:refresh", {});
    return { ok: true };
  },
);
