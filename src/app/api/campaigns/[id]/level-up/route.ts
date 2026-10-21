import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters, messages } from "@/db/schema";
import { bad, route, zId } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { requireCampaignGM, requireSystem } from "@/lib/access";
import { notifyCampaign } from "@/lib/realtime-bus";
import { STAT_KEYS, STAT_LABELS, STAT_MAX } from "@/lib/shz/constants";
import { getTree } from "@/lib/shz/content";

const zStat = z.enum(STAT_KEYS);

const levelUpMessage = (list: string, mvp: string | null) =>
  mvp ? fmt("Seviye atlayanlar: {list} · MVP: {mvp}", { list, mvp }) : fmt("Seviye atlayanlar: {list}", { list });

/**
 * Toplu seviye atlatma (Core: her seviyede 1 yetenek puanı + 2+1 stat).
 *  - ağaç stat'ı +1 (10 ise oyuncuya serbest puan)
 *  - aksiyon bazlı +1 (GM seçer)
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
    requireSystem(camp, "SHZ");
    const ids = body.entries.map((e) => e.characterId);
    if (new Set(ids).size !== ids.length) throw bad("Aynı karakter iki kez seçilmiş.");
    if (body.mvp && !ids.includes(body.mvp.characterId)) throw bad("MVP, seviye atlayanlardan biri olmalı.");

    // Okuma ve yazma aynı işlemde, satırlar kilitli: eşzamanlı puan harcamalarıyla yarışmaz.
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
        const stats = { ...c.stats };
        const notes: string[] = [];
        let freeBonus = 0;
        const tree = getTree(c.trees[0] ?? "");
        if (tree) {
          if (stats[tree.stat] < STAT_MAX) {
            stats[tree.stat]++;
            notes.push(fmt("{stat} +1 (ağaç)", { stat: STAT_LABELS[tree.stat] }));
          } else {
            freeBonus = 1;
            notes.push(fmt("ağaç stat'ı 10 olduğu için +1 serbest puan"));
          }
        }
        if (stats[e.actionStat] >= STAT_MAX) throw bad("{name}: {stat} zaten {max}. Başka bir aksiyon stat'ı seç.", { name: c.name, stat: STAT_LABELS[e.actionStat], max: STAT_MAX });
        stats[e.actionStat]++;
        notes.push(fmt("{stat} +1 (aksiyon)", { stat: STAT_LABELS[e.actionStat] }));
        if (body.mvp?.characterId === c.id) {
          if (stats[body.mvp.stat] >= STAT_MAX) throw bad("{name}: MVP için seçilen {stat} zaten {max}.", { name: c.name, stat: STAT_LABELS[body.mvp.stat], max: STAT_MAX });
          stats[body.mvp.stat]++;
          notes.push(`${STAT_LABELS[body.mvp.stat]} +1 (MVP)`);
        }
        return { c, stats, freeBonus, notes };
      });

      for (const p of plans) {
        await tx
          .update(characters)
          .set({
            level: sql`${characters.level} + 1`,
            abilityPoints: sql`${characters.abilityPoints} + 1`,
            freeStatPoints: sql`${characters.freeStatPoints} + ${p.freeBonus}`,
            stats: p.stats,
          })
          .where(eq(characters.id, p.c.id));
        await tx.insert(characterLogs).values({
          characterId: p.c.id,
          actorId: user.id,
          kind: "level-up",
          text: fmt("Seviye {from} → {to}: +1 yetenek puanı, {notes}", { from: p.c.level, to: p.c.level + 1, notes: p.notes.join(", ") }),
        });
      }
      await tx.insert(messages).values({
        campaignId: camp.id,
        userId: user.id,
        channel: "SYSTEM",
        content: levelUpMessage(
          plans.map((p) => fmt("{name} (Sv {level})", { name: p.c.name, level: p.c.level + 1 })).join(", "),
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
