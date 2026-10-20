// Umbra Caelis kural motoru. Saf fonksiyonlardır; sunucuda (doğrulama) ve istemcide (önizleme) aynı sonucu verir.
// Beden/yara sistemi SHZ ile aynıdır (Body.md): yara cezaları ve sargı formülleri ortak kullanılır.
import type { UcCharData, UcForkChoice } from "../../db/schema";
import { bodyPartLabel, type BodyPartKey } from "../shz/constants";
import { normalizeBody, woundPenalty, type BodyState } from "../shz/rules";
import { UC_STAT_KEYS, UC_STAT_LABELS, UC_TIER_OPEN, ucStatFromLabel, type UcStatKey } from "./constants";
import type { UcRequirement } from "./content-types";

export const UC_STAT_MAX = 10;
export const UC_LEVEL_MAX = 15;
export const UC_DECAY_MAX = 15;
/** Başlangıç: 2 puan K1 dalının sembol stat'ına, 2 puan sembol stat hariç dilediğin statlara. */
export const UC_START_SYMBOL = 2;
export const UC_START_FREE = 2;
/** Negatif perklerden en fazla bu kadar perk puanı kazanılır (fazlası GM onayıyla). */
export const UC_NEG_PERK_CAP = 10;
/** Esin borcu: eksi başına her zara −2. */
export const UC_ESIN_DEBT = 2;
export const UC_FORK_LEVELS = ["3", "6", "9", "12"] as const;
export type UcForkLevel = (typeof UC_FORK_LEVELS)[number];
/** Teslim seçilen çatal, halkanın ilk seviyesini taban yapar. */
export const UC_FORK_FLOOR: Record<UcForkLevel, number> = { "3": 1, "6": 4, "9": 7, "12": 10 };
export const UC_FORK_INFO: Record<UcForkLevel, { title: string; teslim: string; direnis: string }> = {
  "3": {
    title: "Çatal I · Fısıltı",
    teslim: "Dinleyen Kulak: seans başına 1 kez sese soru sorarsın (GM gizlice d6: 1-4 doğru, 5-6 yalan).",
    direnis: "Kapalı Kapı: zihin kontrolü, rüya ve korkuya karşı Sebahat +2. Uzun dinlenmeden sonraki ilk zara −1.",
  },
  "6": {
    title: "Çatal II · Açlık",
    teslim: "Emici: büyücüye isabette senin sonraki zarına +2, onun sonraki büyü zarına −2 (çatışma başına 2).",
    direnis: "Oruç: Düşotu sende işe yaramaz; Yozlaşma artışlarına karşı attığın tüm zarlara +2.",
  },
  "9": {
    title: "Çatal III · Ad",
    teslim: "Ahit: sesin talebini yerine getirirsin; kalıcı Efsun ya da Sebahat +1 (GM işler).",
    direnis: "Ret: seçtiğin bir uzuv kalıcı Çizik olur; o seans Yozlaşman artmaz.",
  },
  "12": {
    title: "Çatal IV · Kapı",
    teslim: "Rüya Yürüyüşü: uyuyanın rüyasına girersin (Efsun, Orta); seans başına 1 yarayı “rüyaydı” sayarsın.",
    direnis: "Mühür: Yozlaşma artışları en fazla +1 uygulanır; büyü zarlarına −2.",
  },
};
export const UC_RINGS = [
  { from: 1, to: 3, name: "Halka I · Kıpırtı" },
  { from: 4, to: 6, name: "Halka II · Sızıntı" },
  { from: 7, to: 9, name: "Halka III · Çatlak" },
  { from: 10, to: 12, name: "Halka IV · Boşluk" },
  { from: 13, to: 15, name: "Halka V · Düşüş" },
];
/** Yozlaşma tablosundaki seviye etkilerinin kısa özeti (karakter kağıdı ve oda için). */
export const UC_DECAY_EFFECTS: Record<number, string> = {
  0: "Ruhun temiz.",
  1: "Rüyaların renklenir. Yoz zarlara +1.",
  2: "Gölgen bir an geç kalır; fark edene karşı Cazibe −1.",
  3: "Çatal I · Fısıltı: ses ilk kez adını söyler.",
  4: "Decayed Mana'yı görürsün; kutsal şifa sende bir kademe zor işler.",
  5: "Hayvanlar seni sevmez; hayvan zarlarına −3.",
  6: "Çatal II · Açlık: içindeki boşluk dolmak ister.",
  7: "Yansıman gecikir; kutsanmış toprakta tüm zarlara −1. Yoz zarlara ek +1.",
  8: "Kayıp An: çatışma başında d20 ≤ Yozlaşma − 5 ise ilk turunu GM oynar.",
  9: "Çatal III · Ad: ses senden bir şey ister.",
  10: "Uyumana gerek kalmaz; uyanmak için Sebahat (Orta). Düşotu artık Yozlaşma vermez.",
  11: "Sesin iki katmanlı: Hakimiyet +2, Cazibe −2.",
  12: "Çatal IV · Kapı: rüya ile gerçek arasındaki kapı.",
  13: "Ses görüş alanında; inananlar Sebahat (Orta) atar. Yoz zarlara ek +1.",
  14: "Gerçeklik incelir: GM sahneleri sana farklı anlatabilir.",
  15: "Son: kararlarının hesabı kesilir.",
};

export type UcStats = Record<UcStatKey, number>;

export interface UcRulesDal {
  key: string;
  name: string;
  classKey: string;
  tier: 1 | 2 | 3;
  stat: UcStatKey;
  identity: string;
  startBonusText: string | null;
  abilities: string[];
}
export interface UcRulesAbility {
  key: string;
  name: string;
  classKey: string;
  dalKey: string;
  tier: 1 | 2 | 3;
  type: string;
  maxLevel: number;
  signature: boolean;
  requirements: UcRequirement[];
  requirementText: string;
}
export interface UcRulesPerk {
  key: string;
  name: string;
  kind: "positive" | "negative";
  points: number;
  category: string;
  exclusive: string[];
}
export interface UcRules {
  classes: { key: string; name: string; dals: string[] }[];
  dals: Record<string, UcRulesDal>;
  abilities: Record<string, UcRulesAbility>;
  perks: UcRulesPerk[];
}

/** Kural hesapları için gereken karakter alanları. `trees` seçilen dallardır (K1, K2, K3), `corruption` Yozlaşma, `inspiration` Esin. */
export interface UcCharLike {
  level: number;
  stats: UcStats;
  trees: string[];
  abilities: Record<string, number>;
  perks: string[];
  body: BodyState;
  corruption: number;
  inspiration: number;
  uc: UcCharData;
}

export function ucEmptyStats(): UcStats {
  return Object.fromEntries(UC_STAT_KEYS.map((k) => [k, 0])) as UcStats;
}
export function ucNormalizeStats(s: Partial<Record<string, number>> | null | undefined): UcStats {
  const out = ucEmptyStats();
  for (const k of UC_STAT_KEYS) out[k] = Number.isFinite(s?.[k]) ? (s![k] as number) : 0;
  return out;
}

export const ucTierOfLevel = (level: number): 1 | 2 | 3 => (level >= UC_TIER_OPEN[3] ? 3 : level >= UC_TIER_OPEN[2] ? 2 : 1);
/** Bonus tavanı: Sv 0'da +4, her yeni katmanda +1 (Sv 5: +5, Sv 10: +6, Sv 15 Zirve: +7). */
export const ucBonusCap = (level: number) => (level >= 15 ? 7 : level >= 10 ? 6 : level >= 5 ? 5 : 4);

/** Dalın "ilk dal (K1) olarak seçilirse +1 X ile başlar" bonusu. */
export function ucDalStartBonus(d: Pick<UcRulesDal, "startBonusText">): { stat: UcStatKey; amount: number } | null {
  const m = /([+-]\s?\d+)\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)/.exec(d.startBonusText ?? "");
  if (!m) return null;
  const stat = ucStatFromLabel(m[2]);
  return stat ? { stat, amount: Number(m[1].replace(/\s/g, "")) } : null;
}

/** Karakterin seçtiği dal (katman başına bir). */
export function ucDalOfTier(c: Pick<UcCharLike, "trees">, tier: 1 | 2 | 3, data: Pick<UcRules, "dals">) {
  return c.trees.map((k) => data.dals[k]).find((d) => d?.tier === tier) ?? null;
}

// ------------------------------------------------------------------ perkler
export interface UcPerkBudget {
  start: number;
  spent: number;
  gained: number;
  left: number;
  convertible: number;
  problems: string[];
  /** Engellemez; GM onayı gerektirir (negatif perk tavanı). */
  warnings: string[];
}
export function ucPerkBudget(keys: string[], start: number, data: Pick<UcRules, "perks">): UcPerkBudget {
  const problems: string[] = [];
  const warnings: string[] = [];
  let spent = 0;
  let gained = 0;
  const picked: UcRulesPerk[] = [];
  for (const k of new Set(keys)) {
    const p = data.perks.find((x) => x.key === k);
    if (!p) {
      problems.push(`Bilinmeyen perk: ${k}`);
      continue;
    }
    picked.push(p);
    if (p.kind === "positive") spent += p.points;
    else gained += p.points;
  }
  for (const p of picked)
    for (const ex of p.exclusive)
      if (picked.some((q) => q.key === ex) && p.key < ex) problems.push(`${p.name} ile ${data.perks.find((q) => q.key === ex)?.name ?? ex} birlikte alınamaz`);
  const left = start + gained - spent;
  if (left < 0) problems.push("Perk puanı negatife düşemez");
  if (gained > UC_NEG_PERK_CAP) warnings.push(`Negatif perklerden +${gained} puan: tavan +${UC_NEG_PERK_CAP}, fazlası için GM onayı gerekir`);
  return { start, spent, gained, left, convertible: left > 0 ? Math.floor((left + 1) / 2) : 0, problems, warnings };
}

// ------------------------------------------------------------------ yetenek puanları
/** Katman başına kazanılan / harcanan puanlar. Katman kilidi: bir katmanda kazanılan puan yalnızca orada harcanır; Sv 15'te 1 serbest Zirve puanı. */
export function ucPoints(c: Pick<UcCharLike, "level" | "abilities">, data: Pick<UcRules, "abilities">) {
  const L = c.level;
  const earned = { 1: Math.min(L, 4) + 1, 2: L >= 5 ? Math.min(L, 9) - 4 : 0, 3: L >= 10 ? Math.min(L, 14) - 9 : 0 } as Record<1 | 2 | 3, number>;
  const spent = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  for (const [k, lv] of Object.entries(c.abilities)) {
    const a = data.abilities[k];
    if (a && lv > 0) spent[a.tier] += lv;
  }
  const zirve = L >= 15 ? 1 : 0;
  const overflow = ([1, 2, 3] as const).reduce((s, t) => s + Math.max(0, spent[t] - earned[t]), 0);
  const zirveLeft = zirve - overflow;
  const available = { 1: Math.max(0, earned[1] - spent[1]), 2: Math.max(0, earned[2] - spent[2]), 3: Math.max(0, earned[3] - spent[3]) } as Record<1 | 2 | 3, number>;
  const unspent = available[1] + available[2] + available[3] + Math.max(0, zirveLeft);
  return { earned, spent, available, zirve, zirveLeft, unspent };
}

export type UcLearnState =
  | { state: "available"; nextLevel: number; usesZirve: boolean; problems: [] }
  | { state: "locked"; nextLevel: number; problems: string[] }
  | { state: "maxed"; nextLevel: number; problems: [] };

function reqProblems(c: Pick<UcCharLike, "stats" | "level" | "corruption">, reqs: UcRequirement[]) {
  const out: string[] = [];
  for (const r of reqs) {
    if (r.kind === "stat" && (c.stats[r.stat] ?? 0) < r.min) out.push(`${UC_STAT_LABELS[r.stat]} ${r.min} gerekli`);
    if (r.kind === "level" && c.level < r.min) out.push(`Sv ${r.min} gerekli`);
    if (r.kind === "decayMin" && c.corruption < r.min) out.push(`Yozlaşma en az ${r.min}`);
    if (r.kind === "decayMax" && c.corruption > r.max) out.push(`Yozlaşma en fazla ${r.max}`);
  }
  return out;
}

export function ucLearnState(c: UcCharLike, abilityKey: string, data: UcRules): UcLearnState {
  const a = data.abilities[abilityKey];
  const lv = c.abilities[abilityKey] ?? 0;
  const next = lv + 1;
  if (!a) return { state: "locked", nextLevel: next, problems: ["Bilinmeyen yetenek"] };
  if (lv >= a.maxLevel) return { state: "maxed", nextLevel: lv, problems: [] };
  const problems: string[] = [];
  if (!c.trees.includes(a.dalKey)) problems.push(`${data.dals[a.dalKey]?.name ?? a.dalKey} dalı seçilmedi`);
  const open = UC_TIER_OPEN[a.tier];
  if (c.level < open) problems.push(`K${a.tier} Sv ${open}'te açılır`);
  if (next === 3 && c.level < open + 2) problems.push(`3. seviye en erken Sv ${open + 2}`);
  if (lv === 0) problems.push(...reqProblems(c, a.requirements));
  const pts = ucPoints(c, data);
  const usesZirve = pts.available[a.tier] <= 0;
  if (usesZirve && pts.zirveLeft <= 0) problems.push(`K${a.tier} için yetenek puanı yok`);
  if (problems.length) return { state: "locked", nextLevel: next, problems };
  return { state: "available", nextLevel: next, usesZirve, problems: [] };
}

/** K2 / K3 dal seçimi (katman açıldığında, katman başına bir dal). */
export function ucOpenDalProblems(c: Pick<UcCharLike, "level" | "trees" | "uc">, dalKey: string, data: Pick<UcRules, "dals">) {
  const d = data.dals[dalKey];
  if (!d) return ["Bilinmeyen dal"];
  const out: string[] = [];
  if (d.classKey !== c.uc.classKey) out.push("Dal ana sınıfına ait değil");
  if (d.tier === 1) out.push("K1 dalı karakter oluştururken seçilir");
  if (c.level < UC_TIER_OPEN[d.tier]) out.push(`K${d.tier} Sv ${UC_TIER_OPEN[d.tier]}'te açılır`);
  if (c.trees.some((k) => data.dals[k]?.tier === d.tier)) out.push(`K${d.tier} dalı zaten seçildi`);
  return out;
}

// ------------------------------------------------------------------ karakter oluşturma
export interface UcCreationInput {
  classKey: string;
  dal: string;
  /** 2 serbest + perklerden dönüşen puanlar. Sembol stat'a yalnızca perklerden dönen puan verilebilir. */
  points: Partial<Record<string, number>>;
  perks: string[];
  firstAbility?: string | null;
}
export interface UcCreationResult {
  ok: boolean;
  problems: string[];
  warnings: string[];
  stats: UcStats;
  abilities: Record<string, number>;
  budget: UcPerkBudget;
}

export function ucBuildCreation(input: UcCreationInput, startPerkPoints: number, data: UcRules): UcCreationResult {
  const problems: string[] = [];
  const stats = ucEmptyStats();
  const cls = data.classes.find((x) => x.key === input.classKey);
  const dal = data.dals[input.dal];
  if (!cls) problems.push("Ana sınıf seçilmedi");
  if (!dal || dal.tier !== 1 || dal.classKey !== input.classKey) problems.push("Ana sınıfın K1 dallarından biri seçilmeli");
  const okDal = dal && dal.tier === 1 && dal.classKey === input.classKey ? dal : null;
  if (okDal) {
    stats[okDal.stat] += UC_START_SYMBOL;
    const b = ucDalStartBonus(okDal);
    if (b) stats[b.stat] += b.amount;
  }
  const budget = ucPerkBudget(input.perks, startPerkPoints, data);
  problems.push(...budget.problems);
  let used = 0;
  for (const [k, v] of Object.entries(input.points)) {
    if (!(UC_STAT_KEYS as readonly string[]).includes(k) || !Number.isInteger(v) || (v ?? 0) < 0) {
      problems.push("Geçersiz stat dağılımı");
      continue;
    }
    stats[k as UcStatKey] += v ?? 0;
    used += v ?? 0;
  }
  const total = UC_START_FREE + budget.convertible;
  if (used !== total) problems.push(`Tam olarak ${total} stat puanı dağıtılmalı (${UC_START_FREE} serbest + ${budget.convertible} perklerden)`);
  if (okDal && (input.points[okDal.stat] ?? 0) > budget.convertible)
    problems.push(
      budget.convertible
        ? `Sembol stat'a (${UC_STAT_LABELS[okDal.stat]}) en fazla ${budget.convertible} puan verilebilir (yalnızca perklerden gelen puanlar)`
        : `Serbest puanlar sembol stat'a (${UC_STAT_LABELS[okDal.stat]}) verilemez`,
    );
  for (const k of UC_STAT_KEYS) if (stats[k] > UC_STAT_MAX) problems.push(`${UC_STAT_LABELS[k]} ${UC_STAT_MAX}'u geçemez`);

  const abilities: Record<string, number> = {};
  if (input.firstAbility) {
    const a = data.abilities[input.firstAbility];
    const c: UcCharLike = { level: 0, stats, trees: okDal ? [okDal.key] : [], abilities: {}, perks: input.perks, body: {}, corruption: 0, inspiration: 0, uc: { classKey: input.classKey } };
    const st = ucLearnState(c, input.firstAbility, data);
    if (!a || a.tier !== 1 || st.state !== "available") problems.push(`İlk yetenek alınamıyor: ${st.problems.join(", ") || "K1 dalından olmalı"}`);
    else abilities[input.firstAbility] = 1;
  }
  return { ok: problems.length === 0, problems, warnings: budget.warnings, stats, abilities, budget };
}

// ------------------------------------------------------------------ yozlaşma
export function ucDecayFloor(forks: UcCharData["forks"]) {
  let f = 0;
  for (const l of UC_FORK_LEVELS) if (forks?.[l] === "teslim") f = Math.max(f, UC_FORK_FLOOR[l]);
  return f;
}
export function ucClampDecay(v: number, forks: UcCharData["forks"]) {
  return Math.max(ucDecayFloor(forks), Math.min(UC_DECAY_MAX, Math.round(v)));
}
/** Yoz zar bonusu: Yoz 1, 7 ve 13'te +1'er (bonus tavanına sayılır). */
export const ucDecayDiceBonus = (decay: number) => (decay >= 1 ? 1 : 0) + (decay >= 7 ? 1 : 0) + (decay >= 13 ? 1 : 0);
/** Ulaşılmış ama kararı verilmemiş ilk çatal. */
export function ucPendingFork(decay: number, forks: UcCharData["forks"]): UcForkLevel | null {
  for (const l of UC_FORK_LEVELS) if (decay >= Number(l) && !forks?.[l]) return l;
  return null;
}
export function ucForkCounts(forks: UcCharData["forks"]) {
  const v = Object.values(forks ?? {}) as UcForkChoice[];
  return { teslim: v.filter((x) => x === "teslim").length, direnis: v.filter((x) => x === "direnis").length };
}
export const ucRingOf = (decay: number) => UC_RINGS.find((r) => decay >= r.from && decay <= r.to) ?? null;

// ------------------------------------------------------------------ zar
export interface UcCheckParams {
  stat: UcStatKey | null;
  part: BodyPartKey | null;
  /** GM/oyuncunun girdiği toplam düzenleyici: artı kısmı bonus tavanına tabidir, eksi kısmı ceza olarak aynen uygulanır. */
  modifier: number;
  /** Büyü zarı (mana ile yapılan aksiyon). */
  magic: boolean;
  /** Yoz zar (Decayed Mana, ölü ruhlar, rüya güçleri). */
  decay: boolean;
}
export interface RollPart {
  label: string;
  value: number;
}

/** d20 hariç tüm eklemeler. Bonuslar (durum + yoz) tavanla sınırlanır; taşan kısım anlatıma döner. */
export function ucCheckParts(c: Pick<UcCharLike, "stats" | "body" | "level" | "corruption" | "inspiration" | "uc">, p: UcCheckParams) {
  const parts: RollPart[] = [];
  if (p.stat) parts.push({ label: UC_STAT_LABELS[p.stat], value: c.stats[p.stat] ?? 0 });
  if (p.part) {
    const pen = woundPenalty(normalizeBody(c.body)[p.part]);
    if (pen) parts.push({ label: `${bodyPartLabel(p.part)} yarası`, value: -pen });
  }
  const cap = ucBonusCap(c.level);
  const bonusSources: RollPart[] = [];
  if (p.modifier > 0) bonusSources.push({ label: "Durum", value: p.modifier });
  if (p.decay && ucDecayDiceBonus(c.corruption)) bonusSources.push({ label: "Yoz zar", value: ucDecayDiceBonus(c.corruption) });
  const bonus = bonusSources.reduce((a, b) => a + b.value, 0);
  const applied = Math.min(bonus, cap);
  if (bonus > 0) parts.push({ label: bonus > cap ? `Bonus (tavan +${cap})` : bonusSources.map((b) => b.label).join(" + "), value: applied });
  if (p.modifier < 0) parts.push({ label: "Ceza", value: p.modifier });
  if (c.inspiration < 0) parts.push({ label: "Esin borcu", value: c.inspiration * UC_ESIN_DEBT });
  if (p.magic && c.uc?.forks?.["12"] === "direnis") parts.push({ label: "Mühür (büyü)", value: -2 });
  return { parts, cap, bonus, overflow: Math.max(0, bonus - cap) };
}

export type UcDecayMode = "dusotu" | "geri-tepme" | "arinma";
export const UC_DECAY_MODES: Record<UcDecayMode, { label: string; hint: string }> = {
  dusotu: { label: "Düşotu", hint: "d20 + Sebahat − Yozlaşma/3 ≥ eşik; başarısızlıkta +1 Yozlaşma. Halka IV+ ve Oruç'ta etkisiz." },
  "geri-tepme": { label: "Mana geri tepmesi", hint: "Büyü zarında Nat1 sonrası: d20 + Sebahat ≥ eşik (genelde Kolay); başarısızlıkta +1 Yozlaşma." },
  arinma: { label: "Blu Mana arınması", hint: "Uzun dinlenmede kristal: d20 + Sebahat ≥ eşik (Zor); başarıda −1 Yozlaşma (taban altına inmez)." },
};

/** Yozlaşma zarlarının d20 dışındaki parçaları. */
export function ucDecayParts(c: Pick<UcCharLike, "stats" | "corruption" | "inspiration" | "uc">, mode: UcDecayMode, modifier: number) {
  const parts: RollPart[] = [{ label: "Sebahat", value: c.stats.sebahat ?? 0 }];
  if (mode === "dusotu") parts.push({ label: "Yozlaşma / 3", value: -Math.floor(c.corruption / 3) });
  // Oruç (Çatal II Direniş): Yozlaşma artışlarına karşı tüm zarlara +2.
  if (mode !== "arinma" && c.uc?.forks?.["6"] === "direnis") parts.push({ label: "Oruç", value: 2 });
  if (modifier) parts.push({ label: "GM durum", value: modifier });
  if (c.inspiration < 0) parts.push({ label: "Esin borcu", value: c.inspiration * UC_ESIN_DEBT });
  return parts;
}

/** Yozlaşma zarının sonucu: yeni değer ve açıklama. */
export function ucDecayOutcome(c: Pick<UcCharLike, "corruption" | "uc">, mode: UcDecayMode, success: boolean) {
  const forks = c.uc?.forks;
  if (mode === "dusotu") {
    if (c.corruption >= 10) return { next: c.corruption, note: "Halka IV+: Düşotu artık Yozlaşma vermez.", effect: "none" as const };
    if (forks?.["6"] === "direnis") return { next: c.corruption, note: "Oruç: Düşotu sende işe yaramaz.", effect: "none" as const };
  }
  if (mode === "arinma") {
    if (!success) return { next: c.corruption, note: "Arınma tutmadı.", effect: "none" as const };
    const next = ucClampDecay(c.corruption - 1, forks);
    return next === c.corruption
      ? { next, note: "Yozlaşma çatal tabanında; daha aşağı inemez.", effect: "none" as const }
      : { next, note: `Yozlaşma ${c.corruption} → ${next}`, effect: "down" as const };
  }
  if (success) return { next: c.corruption, note: "Yozlaşma artmadı.", effect: "none" as const };
  const next = ucClampDecay(c.corruption + 1, forks);
  return { next, note: `Yozlaşma ${c.corruption} → ${next}`, effect: "up" as const };
}

/** Seviye atlamada sembol stat'ın hangi katmanın dalından geleceği (yeni seviyeye göre). */
export const ucSymbolTierForLevel = (newLevel: number): 1 | 2 | 3 => ucTierOfLevel(newLevel);
