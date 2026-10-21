import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters, messages, type Character, type UcCharData } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged, notifyCampaign } from "@/lib/realtime-bus";
import { asUcChar, ucStatsColumn, ucUnspent } from "@/lib/uc/char";
import { UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import { ucRulesData } from "@/lib/uc/content";
import { UC_DECAY_MAX, UC_FORK_LEVELS, UC_LEVEL_MAX, UC_STAT_MAX, ucClampDecay, ucDecayFloor } from "@/lib/uc/rules";

const zFork = z.enum(["teslim", "direnis"]).nullable();

/** GM'in Umbra Caelis karakteri üzerindeki tam yetkili düzenlemeleri. Her değişiklik kayda geçer. */
export const PATCH = route(
  {
    limit: 120,
    body: z.object({
      level: z.number().int().min(0).max(UC_LEVEL_MAX).optional(),
      freeStatPoints: z.number().int().min(0).max(50).optional(),
      stats: z.partialRecord(z.enum(UC_STAT_KEYS), z.number().int().min(-20).max(UC_STAT_MAX)).optional(),
      corruption: z.number().int().min(0).max(UC_DECAY_MAX).optional(),
      inspiration: z.number().int().min(-20).max(50).optional(),
      status: z.enum(["ACTIVE", "DEAD", "RETIRED", "PENDING", "REJECTED"]).optional(),
      gmNotes: z.string().max(8000).optional(),
      classKey: z.string().max(60).optional(),
      trees: z.array(z.string().max(60)).max(3).optional(),
      abilities: z.record(z.string().max(80), z.number().int().min(0).max(3)).optional(),
      perks: z.array(z.string().max(80)).max(40).optional(),
      forks: z.partialRecord(z.enum(UC_FORK_LEVELS), zFork).optional(),
      deathSave: z.object({ available: z.boolean(), resets: z.number().int().min(0).max(50) }).optional(),
      perkEditAllowed: z.boolean().optional(),
      revive: z.literal(true).optional(),
      reason: z.string().trim().max(200).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "UC");
    if (!a.isGM) throw forbidden();
    const c = a.character;
    const data = ucRulesData();
    const set: Partial<Character> = {};
    const log: string[] = [];
    let uc: UcCharData = { ...(c.uc ?? {}) };

    if (body.level !== undefined && body.level !== c.level) {
      set.level = body.level;
      log.push(fmt("seviye {from} → {to}", { from: c.level, to: body.level }));
    }
    if (body.freeStatPoints !== undefined && body.freeStatPoints !== c.freeStatPoints) {
      set.freeStatPoints = body.freeStatPoints;
      log.push(fmt("serbest stat puanı {from} → {to}", { from: c.freeStatPoints, to: body.freeStatPoints }));
    }
    if (body.stats) {
      const next = asUcChar(c).stats;
      for (const [k, v] of Object.entries(body.stats) as [keyof typeof next, number][]) {
        if (next[k] !== v) log.push(`${UC_STAT_LABELS[k]} ${next[k]} → ${v}`);
        next[k] = v;
      }
      set.stats = ucStatsColumn(next);
    }
    if (body.forks) {
      const forks = { ...(uc.forks ?? {}) };
      for (const [l, v] of Object.entries(body.forks) as [(typeof UC_FORK_LEVELS)[number], "teslim" | "direnis" | null][]) {
        if ((forks[l] ?? null) === v) continue;
        if (v) forks[l] = v;
        else delete forks[l];
        log.push(fmt(v === "teslim" ? "Çatal {level}: Teslim" : v === "direnis" ? "Çatal {level}: Direniş" : "Çatal {level}: karar silindi", { level: l }));
      }
      uc = { ...uc, forks };
    }
    if (body.corruption !== undefined || body.forks) {
      const want = body.corruption ?? c.corruption;
      const v = ucClampDecay(want, uc.forks);
      if (body.corruption !== undefined && v !== want) log.push(fmt("Yozlaşma çatal tabanı ({floor}) altına inemez", { floor: ucDecayFloor(uc.forks) }));
      if (v !== c.corruption) log.push(fmt("Yozlaşma {from} → {to}", { from: c.corruption, to: v }));
      set.corruption = v;
    }
    if (body.inspiration !== undefined && body.inspiration !== c.inspiration) {
      set.inspiration = body.inspiration;
      log.push(fmt("Esin {from} → {to}", { from: c.inspiration, to: body.inspiration }));
    }
    if (body.status && body.status !== c.status) {
      set.status = body.status;
      log.push(fmt("durum {from} → {to}", { from: c.status, to: body.status }));
    }
    if (body.gmNotes !== undefined) set.gmNotes = body.gmNotes;
    if (body.classKey !== undefined && body.classKey !== uc.classKey) {
      if (!data.classes.some((x) => x.key === body.classKey)) throw bad("Bilinmeyen sınıf.");
      uc = { ...uc, classKey: body.classKey };
      log.push(fmt("ana sınıf: {name}", { name: data.classes.find((x) => x.key === body.classKey)!.name }));
    }
    if (body.trees) {
      const trees = [...new Set(body.trees)];
      if (trees.some((t) => !data.dals[t])) throw bad("Bilinmeyen dal.");
      const tiers = trees.map((t) => data.dals[t].tier);
      if (new Set(tiers).size !== tiers.length) throw bad("Her katmanda yalnızca bir dal seçilebilir.");
      set.trees = trees.sort((x, y) => data.dals[x].tier - data.dals[y].tier);
      log.push(fmt("dallar: {list}", { list: set.trees.map((t) => data.dals[t].name).join(", ") || "yok" }));
    }
    if (body.abilities) {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.abilities)) {
        const ab = data.abilities[k];
        if (!ab) throw bad("Bilinmeyen yetenek: {key}", { key: k });
        if (v > ab.maxLevel) throw bad("{name} en fazla {max}. seviye olabilir.", { name: ab.name, max: ab.maxLevel });
        if (v > 0) next[k] = v;
      }
      set.abilities = next;
      log.push(fmt("yetenekler GM tarafından düzenlendi"));
    }
    if (body.perks) {
      if (body.perks.some((p) => !data.perks.some((x) => x.key === p))) throw bad("Bilinmeyen perk.");
      set.perks = [...new Set(body.perks)];
      log.push(fmt("perkler: {list}", { list: set.perks.map((p) => data.perks.find((x) => x.key === p)!.name).join(", ") || "yok" }));
    }
    if (body.deathSave) {
      set.deathSave = { ...c.deathSave, ...body.deathSave };
      log.push(body.deathSave.available ? fmt("Death Save hakkı verildi") : fmt("Death Save hakkı kaldırıldı"));
    }
    if (body.perkEditAllowed !== undefined && body.perkEditAllowed !== c.perkEditAllowed) {
      set.perkEditAllowed = body.perkEditAllowed;
      log.push(body.perkEditAllowed ? fmt("perk düzenleme izni verildi") : fmt("perk düzenleme izni kaldırıldı"));
    }
    let announce: string | null = null;
    if (body.revive) {
      if (c.status !== "DEAD") throw bad("Karakter ölü değil.");
      set.status = "ACTIVE";
      set.deathSave = { ...c.deathSave, available: true, deaths: 0, saves: 0 };
      log.push(fmt("karakter diriltildi"));
      announce = fmt("✚ {name} GM tarafından diriltildi.", { name: c.name });
    }
    if (JSON.stringify(uc) !== JSON.stringify(c.uc ?? {})) set.uc = uc;
    if (set.level !== undefined || set.abilities) set.abilityPoints = ucUnspent({ level: set.level ?? c.level, abilities: set.abilities ?? c.abilities }, data);
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
