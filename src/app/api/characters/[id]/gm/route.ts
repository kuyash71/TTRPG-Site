import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters, type Character } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
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
      treeGrants: z.array(z.string().max(60)).max(10).optional(),
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
      log.push(fmt("seviye {from} → {to}", { from: c.level, to: body.level }));
    }
    if (body.abilityPoints !== undefined && body.abilityPoints !== c.abilityPoints) {
      set.abilityPoints = body.abilityPoints;
      log.push(fmt("yetenek puanı {from} → {to}", { from: c.abilityPoints, to: body.abilityPoints }));
    }
    if (body.freeStatPoints !== undefined && body.freeStatPoints !== c.freeStatPoints) {
      set.freeStatPoints = body.freeStatPoints;
      log.push(fmt("serbest stat puanı {from} → {to}", { from: c.freeStatPoints, to: body.freeStatPoints }));
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
      if (unlock && c.corruptionLocked) log.push(fmt("Corruption kilidi kaldırıldı"));
      set.corruption = r.value;
      set.corruptionLocked = unlock ? false : r.locked;
    }
    if (body.inspiration !== undefined && body.inspiration !== c.inspiration) {
      set.inspiration = body.inspiration;
      log.push(`Inspiration ${c.inspiration} → ${body.inspiration}`);
    }
    if (body.status && body.status !== c.status) {
      set.status = body.status;
      log.push(fmt("durum {from} → {to}", { from: c.status, to: body.status }));
    }
    if (body.gmNotes !== undefined) set.gmNotes = body.gmNotes;
    if (body.trees) {
      if (body.trees.some((t) => !getTree(t))) throw bad("Bilinmeyen ağaç.");
      set.trees = [...new Set(body.trees)];
      log.push(fmt("ağaçlar: {list}", { list: set.trees.map((t) => getTree(t)!.name).join(", ") }));
    }
    if (body.abilities) {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.abilities)) {
        const ab = getAbility(k);
        if (!ab) throw bad("Bilinmeyen yetenek: {key}", { key: k });
        if (v > ab.maxLevel) throw bad("{name} en fazla {max}. seviye olabilir.", { name: ab.name, max: ab.maxLevel });
        if (v > 0) next[k] = v;
      }
      set.abilities = next;
      log.push(fmt("yetenekler GM tarafından düzenlendi"));
    }
    if (body.perks) {
      if (body.perks.some((p) => !getPerk(p))) throw bad("Bilinmeyen perk.");
      set.perks = [...new Set(body.perks)];
      log.push(fmt("perkler: {list}", { list: set.perks.map((p) => getPerk(p)!.name).join(", ") || "yok" }));
    }
    if (body.deathSave) {
      set.deathSave = { ...c.deathSave, ...body.deathSave };
      log.push(body.deathSave.available ? fmt("Death Save hakkı verildi") : fmt("Death Save hakkı kaldırıldı"));
    }
    if (body.perkEditAllowed !== undefined && body.perkEditAllowed !== c.perkEditAllowed) {
      set.perkEditAllowed = body.perkEditAllowed;
      log.push(body.perkEditAllowed ? fmt("perk düzenleme izni verildi") : fmt("perk düzenleme izni kaldırıldı"));
    }
    if (body.treeGrants) {
      const next = [...new Set(body.treeGrants)];
      if (next.some((t) => !getTree(t)?.restricted)) throw bad("Bu ağaç için izin gerekmez.");
      const added = next.filter((t) => !c.treeGrants.includes(t));
      const removed = c.treeGrants.filter((t) => !next.includes(t));
      for (const t of added) log.push(fmt("{tree} açma izni verildi", { tree: getTree(t)!.name }));
      for (const t of removed) log.push(fmt("{tree} açma izni kaldırıldı", { tree: getTree(t)!.name }));
      if (added.length || removed.length) set.treeGrants = next;
    }
    let announce: string | null = null;
    if (body.revive) {
      if (c.status !== "DEAD") throw bad("Karakter ölü değil.");
      set.status = "ACTIVE";
      set.deathSave = { ...c.deathSave, available: true, deaths: 0, saves: 0 };
      log.push(fmt("karakter diriltildi"));
      announce = fmt("✚ {name} GM tarafından diriltildi.", { name: c.name });
    }
    if (body.refund && (body.refund.stats || body.refund.abilities)) {
      const plan = refundPlan({ ...c, stats: (set.stats as typeof c.stats) ?? c.stats }, rulesData());
      if (body.refund.stats && plan.statPoints > 0) {
        set.stats = plan.stats;
        set.freeStatPoints = (set.freeStatPoints ?? c.freeStatPoints) + plan.statPoints;
        log.push(fmt("{n} stat puanı iade edildi", { n: plan.statPoints }));
      }
      if (body.refund.abilities && plan.abilityPoints > 0) {
        set.abilities = {};
        set.trees = plan.trees;
        set.abilityPoints = (set.abilityPoints ?? c.abilityPoints) + plan.abilityPoints;
        log.push(fmt("{n} yetenek puanı iade edildi (yetenekler ve ek ağaçlar sıfırlandı)", { n: plan.abilityPoints }));
      }
    }
    if (!Object.keys(set).length) return { ok: true };
    await db.update(characters).set(set).where(eq(characters.id, c.id));
    if (log.length)
      await addLog(
        c.id,
        user.id,
        "gm",
        body.reason ? fmt("GM: {changes} ({reason})", { changes: log.join(", "), reason: body.reason }) : fmt("GM: {changes}", { changes: log.join(", ") }),
      );
    characterChanged(a.campaign.id, c.id);
    if (announce) {
      const [m] = await db.insert(messages).values({ campaignId: a.campaign.id, userId: user.id, channel: "SYSTEM", content: announce }).returning();
      notifyCampaign(a.campaign.id, "message", { ...m, userName: user.displayName, characterName: null });
    }
    return { ok: true };
  },
);
