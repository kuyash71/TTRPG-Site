import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters, type Character } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged, notifyCampaign } from "@/lib/realtime-bus";
import { messages } from "@/db/schema";
import { CORRUPTION_MAX, LEVEL_CAP_MAX, MAX_TREES, STAT_KEYS, STAT_LABELS, STAT_MAX } from "@/lib/shz/constants";
import { getAbility, getPerk, getTree, rulesData } from "@/lib/shz/content";
import { clampCorruption, refundPlan } from "@/lib/shz/rules";

/** GM'in karakter üzerindeki tam yetkili düzenlemeleri. Her değişiklik kayda geçer. */
export const PATCH = route(
  {
    limit: 120,
    body: z.object({
      level: z.number().int().min(0).max(LEVEL_CAP_MAX).optional(),
      abilityPoints: z.number().int().min(0).max(50).optional(),
      freeStatPoints: z.number().int().min(0).max(50).optional(),
      stats: z.partialRecord(z.enum(STAT_KEYS), z.number().int().min(-20).max(STAT_MAX)).optional(),
      corruption: z.number().int().min(0).max(CORRUPTION_MAX).optional(),
      corruptionLocked: z.boolean().optional(),
      inspiration: z.number().int().min(-20).max(50).optional(),
      status: z.enum(["ACTIVE", "DEAD", "RETIRED", "PENDING", "REJECTED"]).optional(),
      gmNotes: z.string().max(8000).optional(),
      trees: z.array(z.string().max(60)).max(MAX_TREES).optional(),
      abilities: z.record(z.string().max(80), z.number().int().min(0).max(3)).optional(),
      perks: z.array(z.string().max(80)).max(40).optional(),
      deathSave: z.object({ available: z.boolean(), resets: z.number().int().min(0).max(50) }).optional(),
      perkEditAllowed: z.boolean().optional(),
      revive: z.literal(true).optional(),
      refund: z.object({ stats: z.boolean(), abilities: z.boolean() }).optional(),
      reason: z.string().trim().max(200).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "SHZ");
    if (!a.isGM) throw forbidden();
    const c = a.character;
    const set: Partial<Character> = {};
    const log: string[] = [];

    if (body.level !== undefined && body.level !== c.level) {
      set.level = body.level;
      log.push(`seviye ${c.level} → ${body.level}`);
    }
    if (body.abilityPoints !== undefined && body.abilityPoints !== c.abilityPoints) {
      set.abilityPoints = body.abilityPoints;
      log.push(`yetenek puanı ${c.abilityPoints} → ${body.abilityPoints}`);
    }
    if (body.freeStatPoints !== undefined && body.freeStatPoints !== c.freeStatPoints) {
      set.freeStatPoints = body.freeStatPoints;
      log.push(`serbest stat puanı ${c.freeStatPoints} → ${body.freeStatPoints}`);
    }
    if (body.stats) {
      const next = { ...c.stats };
      for (const [k, v] of Object.entries(body.stats) as [keyof typeof next, number][]) {
        if (next[k] !== v) log.push(`${STAT_LABELS[k]} ${next[k]} → ${v}`);
        next[k] = v;
      }
      set.stats = next;
    }
    if (body.corruption !== undefined || body.corruptionLocked !== undefined) {
      // GM kilidi açıkça kaldırabilir; aksi halde 7 kuralı uygulanır.
      const unlock = body.corruptionLocked === false;
      const r = clampCorruption(body.corruption ?? c.corruption, unlock ? false : (body.corruptionLocked ?? c.corruptionLocked));
      if (r.value !== c.corruption) log.push(`Corruption ${c.corruption} → ${r.value}`);
      if (unlock && c.corruptionLocked) log.push("Corruption kilidi kaldırıldı");
      set.corruption = r.value;
      set.corruptionLocked = unlock ? false : r.locked;
    }
    if (body.inspiration !== undefined && body.inspiration !== c.inspiration) {
      set.inspiration = body.inspiration;
      log.push(`Inspiration ${c.inspiration} → ${body.inspiration}`);
    }
    if (body.status && body.status !== c.status) {
      set.status = body.status;
      log.push(`durum ${c.status} → ${body.status}`);
    }
    if (body.gmNotes !== undefined) set.gmNotes = body.gmNotes;
    if (body.trees) {
      if (body.trees.some((t) => !getTree(t))) throw bad("Bilinmeyen ağaç.");
      set.trees = [...new Set(body.trees)];
      log.push(`ağaçlar: ${set.trees.map((t) => getTree(t)!.name).join(", ")}`);
    }
    if (body.abilities) {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.abilities)) {
        const ab = getAbility(k);
        if (!ab) throw bad(`Bilinmeyen yetenek: ${k}`);
        if (v > ab.maxLevel) throw bad(`${ab.name} en fazla ${ab.maxLevel}. seviye olabilir.`);
        if (v > 0) next[k] = v;
      }
      set.abilities = next;
      log.push("yetenekler GM tarafından düzenlendi");
    }
    if (body.perks) {
      if (body.perks.some((p) => !getPerk(p))) throw bad("Bilinmeyen perk.");
      set.perks = [...new Set(body.perks)];
      log.push(`perkler: ${set.perks.map((p) => getPerk(p)!.name).join(", ") || "yok"}`);
    }
    if (body.deathSave) {
      set.deathSave = { ...c.deathSave, ...body.deathSave };
      log.push(`Death Save ${body.deathSave.available ? "hakkı verildi" : "hakkı kaldırıldı"}`);
    }
    if (body.perkEditAllowed !== undefined && body.perkEditAllowed !== c.perkEditAllowed) {
      set.perkEditAllowed = body.perkEditAllowed;
      log.push(body.perkEditAllowed ? "perk düzenleme izni verildi" : "perk düzenleme izni kaldırıldı");
    }
    let announce: string | null = null;
    if (body.revive) {
      if (c.status !== "DEAD") throw bad("Karakter ölü değil.");
      set.status = "ACTIVE";
      set.deathSave = { ...c.deathSave, available: true, deaths: 0, saves: 0 };
      log.push("karakter diriltildi");
      announce = `✚ ${c.name} GM tarafından diriltildi.`;
    }
    if (body.refund && (body.refund.stats || body.refund.abilities)) {
      const plan = refundPlan({ ...c, stats: (set.stats as typeof c.stats) ?? c.stats }, rulesData());
      if (body.refund.stats && plan.statPoints > 0) {
        set.stats = plan.stats;
        set.freeStatPoints = (set.freeStatPoints ?? c.freeStatPoints) + plan.statPoints;
        log.push(`${plan.statPoints} stat puanı iade edildi`);
      }
      if (body.refund.abilities && plan.abilityPoints > 0) {
        set.abilities = {};
        set.trees = plan.trees;
        set.abilityPoints = (set.abilityPoints ?? c.abilityPoints) + plan.abilityPoints;
        log.push(`${plan.abilityPoints} yetenek puanı iade edildi (yetenekler ve ek ağaçlar sıfırlandı)`);
      }
    }
    if (!Object.keys(set).length) return { ok: true };
    await db.update(characters).set(set).where(eq(characters.id, c.id));
    if (log.length) await addLog(c.id, user.id, "gm", `GM: ${log.join(", ")}${body.reason ? ` (${body.reason})` : ""}`);
    characterChanged(a.campaign.id, c.id);
    if (announce) {
      const [m] = await db.insert(messages).values({ campaignId: a.campaign.id, userId: user.id, channel: "SYSTEM", content: announce }).returning();
      notifyCampaign(a.campaign.id, "message", { ...m, userName: user.displayName, characterName: null });
    }
    return { ok: true };
  },
);
