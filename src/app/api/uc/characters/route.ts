import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characterLogs, characters } from "@/db/schema";
import { bad, conflict, route, zId } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { badLoose } from "@/lib/api-loose";
import { campaignAccess } from "@/lib/access";
import { languageProblems } from "@/lib/languages";
import { notifyCampaign } from "@/lib/realtime-bus";
import { AGE_MAX, AGE_MIN } from "@/lib/shz/constants";
import { ucStatsColumn } from "@/lib/uc/char";
import { UC_STAT_KEYS } from "@/lib/uc/constants";
import { ucClass, ucRulesData } from "@/lib/uc/content";
import { ucResolveFaith } from "@/lib/uc/faith";
import { ucBuildCreation, ucPoints } from "@/lib/uc/rules";

const statMap = z.partialRecord(z.enum(UC_STAT_KEYS), z.number().int().min(0).max(10));

/** Oluşturma kaydı: her biçim ayrı şablon (kayıtta Türkçe, gösterilirken çevrilir). */
function creationLog(v: { cls?: string; dal?: string; faith: string | null; corruption: number; perks: string; warnings: string }) {
  const x = { cls: v.cls ?? "undefined", dal: v.dal ?? "undefined", faith: v.faith, n: v.corruption, perks: v.perks, warnings: v.warnings };
  if (!v.faith)
    return v.warnings
      ? fmt("Karakter oluşturuldu: {cls} · {dal}; perkler: {perks} ({warnings}).", x)
      : fmt("Karakter oluşturuldu: {cls} · {dal}; perkler: {perks}.", x);
  if (!v.corruption)
    return v.warnings
      ? fmt("Karakter oluşturuldu: {cls} · {dal}; inanç: {faith}; perkler: {perks} ({warnings}).", x)
      : fmt("Karakter oluşturuldu: {cls} · {dal}; inanç: {faith}; perkler: {perks}.", x);
  return v.warnings
    ? fmt("Karakter oluşturuldu: {cls} · {dal}; inanç: {faith} (+{n} Yozlaşma ile başlar); perkler: {perks} ({warnings}).", x)
    : fmt("Karakter oluşturuldu: {cls} · {dal}; inanç: {faith} (+{n} Yozlaşma ile başlar); perkler: {perks}.", x);
}

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
      faithKey: z.string().trim().max(120).nullable().default(null),
      faithDetail: z.string().trim().max(60).default(""),
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
  async ({ req, body, user }) => {
    const { campaign, isGM, isSpectator } = await campaignAccess(body.campaignId, user);
    if (campaign.system !== "UC") throw bad("Bu kampanya bir Schwarzesonne kampanyası.");
    if (campaign.status === "ARCHIVED") throw bad("Bu kampanya arşivlenmiş.");
    if (isSpectator) throw bad("İzleyiciler karakter oluşturamaz.");
    const data = ucRulesData();
    const r = ucBuildCreation(body.creation, campaign.startPerkPoints, data);
    if (!r.ok) throw badLoose(req, r.problems[0]);
    const faiths = ucClass(body.creation.classKey)?.faiths;
    const pick = faiths?.length ? ucResolveFaith(faiths, body.faithKey, body.faithDetail) : null;
    if (faiths?.length && !pick) throw bad("İnanç seçimi eksik ya da geçersiz.");
    const faith = pick ? pick.label : body.faith;
    const lp = languageProblems("UC", body.creation.perks, body.languages);
    if (lp.length) throw badLoose(req, lp[0]);

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
          corruption: pick?.startCorruption ?? 0,
          uc: {
            classKey: body.creation.classKey,
            faith,
            ...(pick && { faithKey: body.faithKey!, ...(body.faithDetail && { faithDetail: body.faithDetail }) }),
            food: body.food,
            forks: {},
          },
        })
        .returning({ id: characters.id });
      return row;
    });
    const dal = data.dals[body.creation.dal];
    await db.insert(characterLogs).values({
      characterId: c.id,
      actorId: user.id,
      kind: "create",
      text: creationLog({
        cls: data.classes.find((x) => x.key === body.creation.classKey)?.name,
        dal: dal?.name,
        faith: pick?.label ?? null,
        corruption: pick?.startCorruption ?? 0,
        perks: body.creation.perks.map((k) => data.perks.find((p) => p.key === k)?.name ?? k).join(", ") || "yok",
        warnings: r.warnings.join("; "),
      }),
    });
    notifyCampaign(campaign.id, "approvals:changed", {});
    return { id: c.id };
  },
);
