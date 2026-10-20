import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters } from "@/db/schema";
import { bad, conflict, route, zId } from "@/lib/api";
import { campaignAccess } from "@/lib/access";
import { notifyCampaign } from "@/lib/realtime-bus";
import { AGE_MAX, AGE_MIN, BODY_PART_KEYS, STAT_KEYS, bodyPartLabel } from "@/lib/shz/constants";
import { getPerk, getTree, rulesData } from "@/lib/shz/content";
import { buildCreation } from "@/lib/shz/rules";
import { languageProblems } from "@/lib/languages";

const statMap = z.partialRecord(z.enum(STAT_KEYS), z.number().int().min(0).max(10));

export const POST = route(
  {
    limit: 20,
    body: z.object({
      campaignId: zId,
      name: z.string().trim().min(2).max(60),
      age: z.number().int().min(AGE_MIN).max(AGE_MAX),
      nationality: z.string().trim().min(2).max(60),
      alignment: z.string().trim().min(2).max(60),
      background: z.string().trim().max(4000).default(""),
      appearance: z.string().trim().max(1000).default(""),
      secretNotes: z.string().trim().max(6000).default(""),
      languages: z.array(z.string().max(60)).max(5).default([]),
      creation: z.object({
        tree: z.string().max(60),
        points: statMap,
        perks: z.array(z.string().max(80)).max(30),
        startAugment: z.object({ key: z.string().max(80), part: z.enum(BODY_PART_KEYS as [string, ...string[]]) }).nullable(),
        firstAbility: z.string().max(80).nullable(),
        amputation: z.array(z.enum(BODY_PART_KEYS as [string, ...string[]])).max(4).nullable().optional(),
      }),
    }),
  },
  async ({ body, user }) => {
    const { campaign, isGM, isSpectator } = await campaignAccess(body.campaignId, user);
    if (campaign.status === "ARCHIVED") throw bad("Bu kampanya arşivlenmiş.");
    if (isSpectator) throw bad("İzleyiciler karakter oluşturamaz.");
    if (campaign.system !== "SHZ") throw bad("Bu kampanya Umbra Caelis kampanyası; karakteri Umbra Caelis bölümünden oluştur.");
    const lp = languageProblems("SHZ", body.creation.perks, body.languages);
    if (lp.length) throw bad(lp[0]);
    const r = buildCreation(body.creation, campaign.startPerkPoints, rulesData());
    if (!r.ok) throw bad(r.problems[0]);

    // Aynı oyuncunun eşzamanlı isteklerini sıraya sok (kampanya başına tek karakter kuralı).
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
          nationality: body.nationality,
          alignment: body.alignment,
          background: body.background,
          appearance: body.appearance,
          secretNotes: body.secretNotes,
          level: 0,
          abilityPoints: r.abilityPoints,
          freeStatPoints: 0,
          stats: r.stats,
          trees: [body.creation.tree],
          abilities: r.abilities,
          perks: [...new Set(body.creation.perks)],
          languages: body.languages,
          body: r.body,
          corruption: r.corruption,
        })
        .returning({ id: characters.id });
      return row;
    });
    const tree = getTree(body.creation.tree);
    await db.insert(characterLogs).values({
      characterId: c.id,
      actorId: user.id,
      kind: "create",
      text: `Karakter oluşturuldu: ${tree?.name ?? "?"} ağacı; perkler: ${body.creation.perks.map((k) => getPerk(k)?.name ?? k).join(", ") || "yok"}${body.creation.amputation?.length && body.creation.perks.includes("kriegsversehrt") ? `; kopuk: ${body.creation.amputation.map(bodyPartLabel).join(", ")}` : ""}.`,
    });
    notifyCampaign(campaign.id, "approvals:changed", {});
    return { id: c.id };
  },
);
