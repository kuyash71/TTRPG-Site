// Schwarzesonne kural motoru. Saf fonksiyonlardır; hem sunucuda (doğrulama)
// hem istemcide (önizleme) aynı sonuçları verir. İçerik parametre olarak gelir.
import {
  ABILITY_LEVEL3_MIN_CHAR_LEVEL,
  AMPUTABLE_PARTS,
  BODY_PARTS,
  CORRUPTION_LOCK,
  CORRUPTION_MAX,
  INSPIRATION_DEBT_PENALTY,
  KRIEGSVERSEHRT,
  LIMB_CHILD,
  LIMB_PARENT,
  MAX_TREES,
  START_FREE_STATS,
  START_KLANG,
  START_TREE_STAT,
  STAT_KEYS,
  STAT_LABELS,
  STAT_MAX,
  THRESHOLDS,
  WOUNDS,
  bodyPartLabel,
  type BandageKey,
  type BodyPartKey,
  type StatKey,
  type WoundKey,
} from "./constants";
import type { Ability, Augment, Perk, Requirement, Tree } from "./content-types";
import { fmt } from "../../i18n/core";

export type Stats = Record<StatKey, number>;
export interface PartState {
  wound: WoundKey;
  bandage: BandageKey;
  augment: string | null;
  note: string;
  lost?: "kriegsversehrt";
}
export type BodyState = Partial<Record<string, PartState>>;

export interface RulesInput {
  trees: Tree[];
  abilities: Record<string, Ability>;
  perks: Perk[];
  augments: Augment[];
}

/** Kural hesapları için gereken karakter alanları. */
export interface CharLike {
  level: number;
  stats: Stats;
  trees: string[];
  abilities: Record<string, number>;
  perks: string[];
  body: BodyState;
  corruption: number;
  inspiration: number;
  abilityPoints: number;
  /** GM'in açılmasına izin verdiği kısıtlı ağaçlar (ör. Mors). */
  treeGrants?: string[];
}

// ------------------------------------------------------------------ Mors
export const MORS_TREE = "mors";
/** Ağır beden kuralının uygulandığı fiziksel statlar. */
export const PHYSICAL_STATS: StatKey[] = ["korp", "krach", "agil", "aim"];
export const isMors = (c: Pick<CharLike, "trees">) => c.trees.includes(MORS_TREE);
/**
 * Mors · Ağır beden: eşik 2 kademe yükselir (Kolay → Zor, Orta → Çok Zor, Zor ve üstü → Uber).
 * Elle girilen eşik, altındaki en yakın kademenin farkı kadar yükselir.
 */
export function morsThreshold(th: { value: number; label: string }, key?: string | null) {
  const i0 = key ? THRESHOLDS.findIndex((t) => t.key === key) : -1;
  if (i0 >= 0) {
    const to = THRESHOLDS[Math.min(THRESHOLDS.length - 1, i0 + 2)];
    return { value: to.value, label: fmt("Mors ağır beden: {from} → {to}", { from: th.label, to: to.label }) };
  }
  let i = 0;
  THRESHOLDS.forEach((t, k) => {
    if (t.value <= th.value) i = k;
  });
  const value = th.value + (THRESHOLDS[Math.min(THRESHOLDS.length - 1, i + 2)].value - THRESHOLDS[i].value);
  return { value, label: fmt("Mors ağır beden: {from} → {to}", { from: th.label, to: value }) };
}
/** Mors'ta işlemeyen (olumsuz) Corruption seviyeleri: Cower, hırçınlık, dengesizlik, Frenzy. */
export const MORS_SUPPRESSED_CORRUPTION = [5, 6, 8, 9, 11, 12];
/** Mors · Kukla beden: yara cezası uygulanmaz (Kopuk uzuv hariç). */
export function bodyPenalty(c: Pick<CharLike, "trees">, part: Pick<PartState, "wound" | "bandage">) {
  return isMors(c) && part.wound !== "kopuk" ? 0 : woundPenalty(part);
}
/** Totenhülle: her 3 (Sv3'te 2) Corruption için kara büyü (Sv1+) ve fiziksel zarlara (Sv2+) +1. */
export function totenhulleBonus(c: Pick<CharLike, "abilities" | "corruption">, opts: { blackMagic: boolean; stat: StatKey | null }) {
  const lv = c.abilities["totenhulle"] ?? 0;
  if (!lv) return 0;
  const per = lv >= 3 ? 2 : 3;
  const v = Math.floor(c.corruption / per);
  if (opts.blackMagic) return v;
  if (lv >= 2 && opts.stat && PHYSICAL_STATS.includes(opts.stat)) return v;
  return 0;
}

export function emptyStats(): Stats {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Stats;
}

export function defaultPart(): PartState {
  return { wound: "saglam", bandage: "yok", augment: null, note: "" };
}
export function normalizeBody(body: BodyState | null | undefined): Record<BodyPartKey, PartState> {
  const out = {} as Record<BodyPartKey, PartState>;
  for (const p of BODY_PARTS) out[p.key] = { ...defaultPart(), ...(body?.[p.key] ?? {}) };
  return out;
}

// ------------------------------------------------------------------ statlar
export interface StatBreakdown {
  base: number;
  value: number;
  parts: { label: string; value: number }[];
  capped: boolean;
}

export function installedAugments(body: BodyState, data: Pick<RulesInput, "augments">) {
  const out: { part: BodyPartKey; augment: Augment }[] = [];
  for (const p of BODY_PARTS) {
    const k = body?.[p.key]?.augment;
    if (!k) continue;
    const a = data.augments.find((x) => x.key === k);
    if (a) out.push({ part: p.key, augment: a });
  }
  return out;
}

export function corruptionKlangBonus(corruption: number) {
  return Math.max(0, corruption - 2);
}

/** Karakterin perklerinden gelen sabit stat etkileri. */
export function perkMods(perkKeys: string[] | undefined, data: Partial<Pick<RulesInput, "perks">>) {
  const out: { perk: Perk; stat: StatKey; value: number }[] = [];
  if (!perkKeys?.length || !data.perks) return out;
  for (const k of perkKeys) {
    const p = data.perks.find((x) => x.key === k);
    for (const m of p?.mods ?? []) out.push({ perk: p!, stat: m.stat, value: m.value });
  }
  return out;
}

/**
 * Augment, perk ve Corruption etkileri eklenmiş stat değerleri.
 * Olumsuz etkiler statı 0'ın altına da düşürebilir (yalnızca üst sınır uygulanır).
 */
export function effectiveStats(c: Pick<CharLike, "stats" | "body" | "corruption"> & { perks?: string[] }, data: Pick<RulesInput, "augments"> & Partial<Pick<RulesInput, "perks">>) {
  const out = {} as Record<StatKey, StatBreakdown>;
  const augs = installedAugments(c.body, data);
  const pm = perkMods(c.perks, data);
  for (const k of STAT_KEYS) {
    const base = c.stats?.[k] ?? 0;
    const parts: { label: string; value: number }[] = [];
    for (const m of pm) if (m.stat === k) parts.push({ label: m.perk.name, value: m.value });
    for (const { augment } of augs) for (const m of augment.mods) if (m.stat === k) parts.push({ label: augment.name, value: m.value });
    if (k === "klang") {
      const b = corruptionKlangBonus(c.corruption);
      if (b) parts.push({ label: "Corruption", value: b });
    }
    const raw = base + parts.reduce((s, p) => s + p.value, 0);
    const value = Math.min(STAT_MAX, raw);
    out[k] = { base, value, parts, capped: value !== raw };
  }
  return out;
}

// ------------------------------------------------------------------ beden
export function woundPenalty(part: Pick<PartState, "wound" | "bandage">): number {
  const w = WOUNDS.find((x) => x.key === part.wound)?.penalty ?? 0;
  if (!w) return 0;
  if (part.bandage === "temiz") return Math.floor(w / 2);
  if (part.bandage === "kirli") return Math.floor((w * 3) / 4);
  return w;
}

// ------------------------------------------------------------------ yetenekler
export interface ReqCheck {
  req: Requirement;
  ok: boolean;
  text: string;
}

export function checkRequirements(c: CharLike, ab: Ability, data: RulesInput): ReqCheck[] {
  const eff = effectiveStats(c, data);
  return ab.requirements.map((r) => {
    switch (r.kind) {
      case "stat":
        return { req: r, ok: eff[r.stat].value >= r.min, text: `${STAT_LABELS[r.stat]} ${r.min}` };
      case "level":
        return { req: r, ok: c.level >= r.min, text: fmt("Seviye {n}", { n: r.min }) };
      case "corruption":
        return { req: r, ok: c.corruption >= r.min, text: fmt("Corruption en az {n}", { n: r.min }) };
      case "augments":
        return { req: r, ok: installedAugments(c.body, data).length >= r.min, text: fmt("En az {n} augment", { n: r.min }) };
      default:
        // Metin gereksinimleri otomatik doğrulanamaz; GM'e bırakılır.
        return { req: r, ok: true, text: r.text };
    }
  });
}

export type LearnState =
  | { state: "maxed"; level: number }
  | { state: "available"; nextLevel: number; problems: [] }
  | { state: "locked"; nextLevel: number; problems: string[] };

export function learnState(c: CharLike, abilityKey: string, data: RulesInput): LearnState {
  const ab = data.abilities[abilityKey];
  if (!ab) return { state: "locked", nextLevel: 1, problems: ["Bilinmeyen yetenek"] };
  const cur = c.abilities[abilityKey] ?? 0;
  if (cur >= ab.maxLevel) return { state: "maxed", level: cur };
  const next = cur + 1;
  const problems: string[] = [];
  if (!c.trees.includes(ab.tree)) problems.push("Ağaç açık değil");
  if (cur === 0) {
    if (ab.prerequisite && !(c.abilities[ab.prerequisite] > 0))
      problems.push(fmt("Öncül: {name}", { name: data.abilities[ab.prerequisite]?.name ?? ab.prerequisite }));
    for (const r of checkRequirements(c, ab, data)) if (!r.ok) problems.push(r.text);
  }
  if (next >= 3 && c.level < ABILITY_LEVEL3_MIN_CHAR_LEVEL) problems.push(fmt("3. seviye için karakter seviyesi {n}", { n: ABILITY_LEVEL3_MIN_CHAR_LEVEL }));
  if (c.abilityPoints < 1) problems.push("Yetenek puanı yok");
  return problems.length ? { state: "locked", nextLevel: next, problems } : { state: "available", nextLevel: next, problems: [] };
}

export function canOpenTree(c: CharLike, treeKey: string, data: RulesInput): string[] {
  const problems: string[] = [];
  if (!data.trees.some((t) => t.key === treeKey)) problems.push("Bilinmeyen ağaç");
  if (c.trees.includes(treeKey)) problems.push("Ağaç zaten açık");
  if (c.trees.length >= MAX_TREES) problems.push(fmt("En fazla {n} ağaç açılabilir", { n: MAX_TREES }));
  const tree = data.trees.find((t) => t.key === treeKey);
  if (tree?.restricted) {
    if (!c.trees.length) problems.push(fmt("{tree} yalnızca 2. ağaç olarak açılabilir", { tree: tree.name }));
    if (!c.treeGrants?.includes(treeKey)) problems.push(fmt("{tree} için GM izni gerekir", { tree: tree.name }));
  }
  if (c.abilityPoints < 1) problems.push("Yetenek puanı yok");
  return problems;
}

/** Bir yetenek alındığında hangi sinerjilerin aktif olduğunu döndürür. */
export function activeSynergies(c: Pick<CharLike, "abilities">, ab: Ability) {
  return ab.synergies.filter((k) => (c.abilities[k] ?? 0) > 0);
}

// ------------------------------------------------------------------ perkler
export interface PerkBudget {
  start: number;
  spent: number;
  gained: number;
  left: number;
  convertible: number;
  problems: string[];
}

/** Kopuk uzuv seçimini doğrular ve etkilenen uzuvları (kol → el, bacak → ayak dahil) döndürür. */
export function amputationPlan(roots: string[]) {
  const problems: string[] = [];
  const uniq = [...new Set(roots)] as BodyPartKey[];
  if (!uniq.length) problems.push("Kriegsversehrt için kopuk uzuv seçilmeli");
  if (uniq.length > KRIEGSVERSEHRT.maxLimbs) problems.push(fmt("En fazla {n} uzuv seçilebilir", { n: KRIEGSVERSEHRT.maxLimbs }));
  for (const r of uniq) if (!AMPUTABLE_PARTS.includes(r)) problems.push(fmt("{part} kopuk seçilemez", { part: bodyPartLabel(r) }));
  for (const r of uniq) {
    const parent = LIMB_PARENT[r];
    if (parent && uniq.includes(parent)) problems.push(fmt("{parent} seçilince {part} zaten kopuk", { parent: bodyPartLabel(parent), part: bodyPartLabel(r) }));
  }
  const parts = new Set<BodyPartKey>();
  for (const r of uniq) {
    parts.add(r);
    const ch = LIMB_CHILD[r];
    if (ch) parts.add(ch);
  }
  return { roots: uniq, parts: [...parts], problems };
}
/** Kriegsversehrt ile kopuk başlayan uzuv sayısı (kol + el tek uzuv sayılır). 0: eski kayıt / bilinmiyor. */
export function kriegsversehrtLimbs(body: BodyState | null | undefined) {
  let n = 0;
  for (const k of AMPUTABLE_PARTS) {
    if (body?.[k]?.lost !== "kriegsversehrt") continue;
    const parent = LIMB_PARENT[k];
    if (parent && body?.[parent]?.lost === "kriegsversehrt") continue;
    n++;
  }
  return n;
}
/** Perkin puanı; Kriegsversehrt uzuv sayısına göre değişir (bilinmiyorsa içerikteki değer). */
export function perkPoints(p: Perk, opts?: { limbs?: number }) {
  if (p.key === KRIEGSVERSEHRT.perk && opts?.limbs) return KRIEGSVERSEHRT.points[Math.min(opts.limbs, KRIEGSVERSEHRT.maxLimbs)] ?? p.points;
  return p.points;
}

export function perkBudget(keys: string[], start: number, data: Pick<RulesInput, "perks">, opts?: { limbs?: number }): PerkBudget {
  const problems: string[] = [];
  let spent = 0;
  let gained = 0;
  const picked: Perk[] = [];
  for (const k of new Set(keys)) {
    const p = data.perks.find((x) => x.key === k);
    if (!p) {
      problems.push(fmt("Bilinmeyen perk: {key}", { key: k }));
      continue;
    }
    picked.push(p);
    if (p.kind === "positive") spent += perkPoints(p, opts);
    else gained += perkPoints(p, opts);
  }
  for (const p of picked)
    for (const ex of p.exclusive)
      if (picked.some((q) => q.key === ex) && p.key < ex)
        problems.push(fmt("{a} ile {b} birlikte alınamaz", { a: p.name, b: data.perks.find((q) => q.key === ex)?.name ?? ex }));
  const left = start + gained - spent;
  if (left < 0) problems.push("Perk puanı negatife düşemez");
  return { start, spent, gained, left, convertible: left > 0 ? Math.floor((left + 1) / 2) : 0, problems };
}

// ------------------------------------------------------------------ karakter yaratma
export interface CreationInput {
  tree: string;
  /** Dağıtılan puanlar: 2 serbest + perklerden dönüşen. Ağaç stat'ına yalnızca perk puanı gidebilir. */
  points: Partial<Stats>;
  perks: string[];
  startAugment?: { key: string; part: string } | null;
  firstAbility?: string | null;
  /** Kriegsversehrt: kopuk seçilen uzuvlar (1–2). */
  amputation?: string[] | null;
}

export interface CreationResult {
  ok: boolean;
  problems: string[];
  stats: Stats;
  corruption: number;
  body: Record<BodyPartKey, PartState>;
  abilities: Record<string, number>;
  abilityPoints: number;
  budget: PerkBudget;
}

function sumPoints(s: Partial<Stats>) {
  return Object.values(s).reduce((a, b) => a + (b ?? 0), 0);
}

export function buildCreation(input: CreationInput, startPerkPoints: number, data: RulesInput): CreationResult {
  const problems: string[] = [];
  const tree = data.trees.find((t) => t.key === input.tree);
  const stats = emptyStats();
  stats.klang = START_KLANG;
  let corruption = 0;
  const body = normalizeBody({});
  if (!tree) problems.push("Başlangıç ağacı seçilmedi");
  else if (tree.restricted) problems.push(fmt("{tree} başlangıç ağacı olarak seçilemez", { tree: tree.name }));
  else {
    stats[tree.stat] += START_TREE_STAT;
    const b = tree.startBonus;
    if (b.kind === "stat") stats[b.stat] += b.amount;
    if (b.kind === "corruption") corruption += b.amount;
  }

  // Kriegsversehrt: seçilen uzuvlar kopuk başlar (kol → el, bacak → ayak da)
  let limbs = 0;
  if (input.perks.includes(KRIEGSVERSEHRT.perk)) {
    const plan = amputationPlan(input.amputation ?? []);
    problems.push(...plan.problems);
    if (!plan.problems.length) {
      limbs = plan.roots.length;
      for (const k of plan.parts) body[k] = { ...body[k], wound: "kopuk", lost: "kriegsversehrt" };
    }
  } else if (input.amputation?.length) problems.push("Kopuk uzuv yalnızca Kriegsversehrt perki ile seçilebilir");

  if (tree && tree.startBonus.kind === "augment") {
    const b = tree.startBonus;
    const a = input.startAugment;
    const aug = a ? data.augments.find((x) => x.key === a.key) : undefined;
    const part = a?.part as BodyPartKey;
    const parent = part ? LIMB_PARENT[part] : undefined;
    if (!a || !aug) problems.push(fmt("{tree} için başlangıç {tier} augment'i seçilmeli", { tree: tree.name, tier: b.tier }));
    else if (aug.tier !== b.tier) problems.push(fmt("Başlangıç augment'i {tier} olmalı", { tier: b.tier }));
    else if (!aug.slots.includes(part)) problems.push(fmt("{augment} bu uzva takılamaz", { augment: aug.name }));
    else if (parent && body[parent].wound === "kopuk") problems.push(fmt("{parent} kopuk olduğu için {part} uzvuna augment takılamaz", { parent: bodyPartLabel(parent), part: bodyPartLabel(part) }));
    else {
      // Kopuk uzvun yerine takılan augment protez olarak çalışır.
      body[part] = { ...body[part], augment: aug.key, ...(body[part].wound === "kopuk" ? { wound: "saglam" as const } : {}) };
    }
  } else if (input.startAugment) problems.push("Bu ağaç başlangıç augment'i vermez");

  const budget = perkBudget(input.perks, startPerkPoints, data, { limbs });
  problems.push(...budget.problems);
  for (const [k, v] of Object.entries(input.points)) {
    if (!(STAT_KEYS as readonly string[]).includes(k) || !Number.isInteger(v) || (v ?? 0) < 0) {
      problems.push("Geçersiz stat dağılımı");
      continue;
    }
    stats[k as StatKey] += v ?? 0;
  }
  const total = START_FREE_STATS + budget.convertible;
  if (sumPoints(input.points) !== total) problems.push(fmt("Tam olarak {total} stat puanı dağıtılmalı ({free} serbest + {perk} perklerden)", { total, free: START_FREE_STATS, perk: budget.convertible }));
  if (tree && (input.points[tree.stat] ?? 0) > budget.convertible)
    problems.push(
      budget.convertible
        ? fmt("Ağaç stat'ına ({stat}) en fazla {n} puan verilebilir (yalnızca perklerden gelen puanlar)", { stat: STAT_LABELS[tree.stat], n: budget.convertible })
        : fmt("Serbest puanlar ağaç stat'ına ({stat}) verilemez", { stat: STAT_LABELS[tree.stat] }),
    );

  for (const k of STAT_KEYS) if (stats[k] > STAT_MAX) problems.push(fmt("{stat} {max}'u geçemez", { stat: STAT_LABELS[k], max: STAT_MAX }));

  const abilities: Record<string, number> = {};
  let abilityPoints = 1;
  if (input.firstAbility) {
    const c: CharLike = {
      level: 0,
      stats,
      trees: tree ? [tree.key] : [],
      abilities: {},
      perks: input.perks,
      body,
      corruption,
      inspiration: 0,
      abilityPoints: 1,
    };
    const st = learnState(c, input.firstAbility, data);
    if (st.state !== "available") problems.push(fmt("İlk yetenek alınamıyor: {reason}", { reason: st.state === "locked" ? st.problems.join(", ") : "zaten alınmış" }));
    else {
      abilities[input.firstAbility] = 1;
      abilityPoints = 0;
    }
  }
  return { ok: problems.length === 0, problems, stats, corruption: Math.min(CORRUPTION_MAX, corruption), body, abilities, abilityPoints, budget };
}

// ------------------------------------------------------------------ corruption
export function clampCorruption(next: number, locked: boolean) {
  let v = Math.max(0, Math.min(CORRUPTION_MAX, Math.round(next)));
  if (locked) v = Math.max(CORRUPTION_LOCK, v);
  return { value: v, locked: locked || v >= CORRUPTION_LOCK };
}

export function blackMagicBonus(corruption: number) {
  const parts: { label: string; value: number }[] = [];
  if (corruption >= 1) parts.push({ label: "Corruption 1+ (kara büyü)", value: 2 });
  if (corruption >= 4) parts.push({ label: fmt("Corruption {n} (kara büyü)", { n: corruption }), value: corruption - 3 });
  return parts;
}

// ------------------------------------------------------------------ zar
export interface CheckParams {
  stat: StatKey | null;
  part: BodyPartKey | null;
  modifier: number;
  blackMagic: boolean;
}

/** d20 sonucu hariç tüm eklemeleri hesaplar. */
export function checkModifiers(c: CharLike, p: CheckParams, data: Pick<RulesInput, "augments"> & Partial<Pick<RulesInput, "perks">>) {
  const parts: { label: string; value: number }[] = [];
  const eff = effectiveStats(c, data);
  if (p.stat) parts.push({ label: STAT_LABELS[p.stat], value: eff[p.stat].value });
  if (p.part) {
    const st = normalizeBody(c.body)[p.part];
    // Mors · Kukla beden: yara cezaları uygulanmaz; Kopuk uzuv yine kullanılamaz.
    const pen = isMors(c) && st.wound !== "kopuk" ? 0 : woundPenalty(st);
    if (pen) parts.push({ label: fmt("{part} yarası", { part: bodyPartLabel(p.part) }), value: -pen });
  }
  if (eff.klang.value < 0 && p.stat !== "klang") parts.push({ label: "Negatif Klang", value: eff.klang.value });
  if (c.inspiration < 0) parts.push({ label: "Inspiration borcu", value: c.inspiration * INSPIRATION_DEBT_PENALTY });
  if (p.blackMagic) parts.push(...blackMagicBonus(c.corruption));
  const th = totenhulleBonus(c, { blackMagic: p.blackMagic, stat: p.stat });
  if (th) parts.push({ label: "Totenhülle", value: th });
  if (p.modifier) parts.push({ label: "Durum", value: p.modifier });
  return parts;
}

export function outcomeFor(d20: number, total: number, threshold: number | null) {
  if (d20 === 20) return "crit-success" as const;
  if (d20 === 1) return "crit-fail" as const;
  if (threshold == null) return "info" as const;
  return total >= threshold ? ("success" as const) : ("fail" as const);
}

export function outcomeLabel(o: string) {
  return (
    {
      "crit-success": "Nat 20",
      "crit-fail": "Nat 1",
      success: "Başarılı",
      fail: "Başarısız",
      death: "Ölüm",
      save: "Kurtuluş",
      info: "",
    } as Record<string, string>
  )[o] ?? o;
}

// ------------------------------------------------------------------ GM iadesi
/**
 * GM iadesi: yaratılıştaki sabit değerlerin (başlangıç Klang, ağaç stat'ı + seviye başına +1,
 * ağaç bonusu) üzerindeki tüm stat puanları serbest puana; tüm yetenek seviyeleri ve sonradan
 * açılan ağaçlar yetenek puanına döner. Seviye değişmez.
 */
export function refundPlan(c: Pick<CharLike, "stats" | "trees" | "abilities" | "level">, data: Pick<RulesInput, "trees">) {
  const tree = data.trees.find((t) => t.key === c.trees[0]);
  const floor = emptyStats();
  floor.klang = START_KLANG;
  if (tree) {
    floor[tree.stat] += START_TREE_STAT + c.level;
    if (tree.startBonus.kind === "stat") floor[tree.startBonus.stat] += tree.startBonus.amount;
  }
  const stats = { ...c.stats } as Stats;
  let statPoints = 0;
  for (const k of STAT_KEYS) {
    const extra = (c.stats[k] ?? 0) - floor[k];
    if (extra > 0) {
      statPoints += extra;
      stats[k] = floor[k];
    }
  }
  const abilityLevels = Object.values(c.abilities).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const extraTrees = Math.max(0, c.trees.length - 1);
  return { stats, statPoints, abilityPoints: abilityLevels + extraTrees, trees: c.trees.slice(0, 1), floor };
}
