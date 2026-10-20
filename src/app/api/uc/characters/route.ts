import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters } from "@/db/schema";
import { bad, conflict, route, zId } from "@/lib/api";
import { campaignAccess } from "@/lib/access";
import { languageProblems } from "@/lib/languages";
import { notifyCampaign } from "@/lib/realtime-bus";
import { AGE_MAX, AGE_MIN } from "@/lib/shz/constants";
import { ucStatsColumn } from "@/lib/uc/char";
import { UC_STAT_KEYS } from "@/lib/uc/constants";
import { ucRulesData } from "@/lib/uc/content";
import { ucBuildCreation, ucPoints } from "@/lib/uc/rules";

const statMap = z.partialRecord(z.enum(UC_STAT_KEYS), z.number().int().min(0).max(10));

/** Umbra Caelis karakteri oluşturur (Character.md sırası: kozmetik → ana sınıf → K1 dal → 2+2 stat → perkler → 1 yetenek puanı). */
export const POST = route(
  {
    limit: 20,
    body: z.object({
      campaignId: zId,
      name: z.string().trim().min(2).max(60),
      age: z.number().int().min(AGE_MIN).max(AGE_MAX),
      race: z.string().trim().min(2).max(60),
      house: z.string().trim().min(2).max(80),
      faith: z.string().trim().max(80).default(""),
      food: z.string().trim().max(120).default(""),
      background: z.string().trim().max(4000).default(""),
      appearance: z.string().trim().max(1000).default(""),
      secretNotes: z.string().trim().max(6000).default(""),
      languages: z.array(z.string().max(60)).max(5).default([]),
      creation: z.object({
        classKey: z.string().max(60),
        dal: z.string().max(60),
        points: statMap,
        perks: z.array(z.string().max(80)).max(30),
        firstAbility: z.string().max(80).nullable(),
      }),
    }),
  },
  async ({ body, user }) => {
    const { campaign, isGM, isSpectator } = await campaignAccess(body.campaignId, user);
    if (campaign.system !== "UC") throw bad("Bu kampanya bir Schwarzesonne kampanyası.");
    if (campaign.status === "ARCHIVED") throw bad("Bu kampanya arşivlenmiş.");
    if (isSpectator) throw bad("İzleyiciler karakter oluşturamaz.");
    const data = ucRulesData();
    const r = ucBuildCreation(body.creation, campaign.startPerkPoints, data);
    if (!r.ok) throw bad(r.problems[0]);
    if (body.creation.classKey === "priest" && !body.faith) throw bad("Priest için inanç zorunludur.");
    const lp = languageProblems("UC", body.creation.perks, body.languages);
    if (lp.length) throw bad(lp[0]);

    const c = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${campaign.id + ":" + user.id}))`);
      if (!isGM) {
        const mine = await tx
          .select({ id: characters.id })
          .from(characters)
          .where(and(eq(characters.campaignId, campaign.id), eq(characters.userId, user.id), inArray(characters.status, ["PENDING", "ACTIVE"])));
        if (mine.length) throw conflict("Bu kampanyada zaten aktif ya da onay bekleyen bir karakterin var.");
      }
      const [row] = await tx
        .insert(characters)
        .values({
          campaignId: campaign.id,
          userId: user.id,
          status: isGM ? "ACTIVE" : "PENDING",
          name: body.name,
          age: body.age,
          nationality: body.race,
          alignment: body.house,
          background: body.background,
          appearance: body.appearance,
          secretNotes: body.secretNotes,
          level: 0,
          abilityPoints: ucPoints({ level: 0, abilities: r.abilities }, data).unspent,
          freeStatPoints: 0,
          stats: ucStatsColumn(r.stats),
          trees: [body.creation.dal],
          abilities: r.abilities,
          perks: [...new Set(body.creation.perks)],
          languages: body.languages,
          corruption: 0,
          uc: { classKey: body.creation.classKey, faith: body.faith, food: body.food, forks: {} },
        })
        .returning({ id: characters.id });
      return row;
    });
    const dal = data.dals[body.creation.dal];
    await db.insert(characterLogs).values({
      characterId: c.id,
      actorId: user.id,
      kind: "create",
      text: `Karakter oluşturuldu: ${data.classes.find((x) => x.key === body.creation.classKey)?.name} · ${dal?.name}; perkler: ${body.creation.perks.map((k) => data.perks.find((p) => p.key === k)?.name ?? k).join(", ") || "yok"}${r.warnings.length ? ` (${r.warnings.join("; ")})` : ""}.`,
    });
    notifyCampaign(campaign.id, "approvals:changed", {});
    return { id: c.id };
  },
);
