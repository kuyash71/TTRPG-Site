import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters, messages } from "@/db/schema";
import { bad, route, zId } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { requireCampaignGM, requireSystem } from "@/lib/access";
import { notifyCampaign } from "@/lib/realtime-bus";
import { asUcChar, ucStatsColumn, ucUnspent } from "@/lib/uc/char";
import { UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import { ucRulesData } from "@/lib/uc/content";
import { UC_STAT_MAX, ucDalOfTier, ucTierOfLevel } from "@/lib/uc/rules";

const zStat = z.enum(UC_STAT_KEYS);

const levelUpMessage = (list: string, mvp: string | null) =>
  mvp ? fmt("Seviye atlayanlar: {list} · MVP: {mvp}", { list, mvp }) : fmt("Seviye atlayanlar: {list}", { list });

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
        if (c.status !== "ACTIVE") throw bad("{name} aktif değil.", { name: c.name });
        if (c.level >= camp.levelCap) throw bad("{name} seviye sınırında ({cap}).", { name: c.name, cap: camp.levelCap });
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
            notes.push(fmt("{stat} +1 (sembol)", { stat: UC_STAT_LABELS[dal.stat] }));
          } else {
            free++;
            notes.push(fmt("sembol stat 10 olduğu için +1 serbest puan"));
          }
        } else {
          pending++;
          notes.push(fmt("K{tier} dalı seçilince sembol stat +1", { tier }));
        }
        if (stats[e.actionStat] >= UC_STAT_MAX) throw bad("{name}: {stat} zaten {max}. Başka bir aksiyon stat'ı seç.", { name: c.name, stat: UC_STAT_LABELS[e.actionStat], max: UC_STAT_MAX });
        stats[e.actionStat]++;
        notes.push(fmt("{stat} +1 (aksiyon)", { stat: UC_STAT_LABELS[e.actionStat] }));
        if (body.mvp?.characterId === c.id) {
          if (stats[body.mvp.stat] >= UC_STAT_MAX) throw bad("{name}: MVP için seçilen {stat} zaten {max}.", { name: c.name, stat: UC_STAT_LABELS[body.mvp.stat], max: UC_STAT_MAX });
          stats[body.mvp.stat]++;
          notes.push(`${UC_STAT_LABELS[body.mvp.stat]} +1 (MVP)`);
        }
        if (newLevel === 5 || newLevel === 10) notes.push(fmt("K{tier} açıldı", { tier }));
        if (newLevel === 15) notes.push(fmt("Zirve: 1 serbest yetenek puanı"));
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
        await tx.insert(characterLogs).values({ characterId: p.c.id, actorId: user.id, kind: "level-up", text: fmt("Seviye {from} → {to}: +1 yetenek puanı, {notes}", { from: p.c.level, to: p.newLevel, notes: p.notes.join(", ") }) });
      }
      await tx.insert(messages).values({
        campaignId: camp.id,
        userId: user.id,
        channel: "SYSTEM",
        content: levelUpMessage(
          plans.map((p) => fmt("{name} (Sv {level})", { name: p.c.name, level: p.newLevel })).join(", "),
          body.mvp ? plans.find((p) => p.c.id === body.mvp!.characterId)!.c.name : null,
        ),
      });
      return plans;
    });
    for (const p of plans) notifyCampaign(camp.id, "character:changed", { characterId: p.c.id });
    notifyCampaign(camp.id, "messages:refresh", {});
    return { ok: true };
  },
);
