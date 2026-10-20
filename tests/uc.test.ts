import assert from "node:assert/strict";
import { test } from "node:test";
import { SHZ_LANGUAGES, cleanLanguages, languageProblems, languageSlots } from "../src/lib/languages";
import { ucRulesData } from "../src/lib/uc/content";
import {
  ucBonusCap,
  ucBuildCreation,
  ucCheckParts,
  ucClampDecay,
  ucDalStartBonus,
  ucDecayDiceBonus,
  ucDecayFloor,
  ucDecayOutcome,
  ucDecayParts,
  ucEmptyStats,
  ucLearnState,
  ucOpenDalProblems,
  ucPendingFork,
  ucPerkBudget,
  ucPoints,
  type UcCharLike,
} from "../src/lib/uc/rules";

const data = ucRulesData();
function char(over: Partial<UcCharLike> = {}): UcCharLike {
  return { level: 0, stats: { ...ucEmptyStats(), yalman: 2, sebahat: 1 }, trees: ["brute"], abilities: {}, perks: [], body: {}, corruption: 0, inspiration: 0, uc: { classKey: "close-quarter" }, ...over };
}

test("UC veri: 4 sınıf, 24 dal, dal başına 5 yetenek, K1 başlangıç bonusları çözülür", () => {
  assert.equal(data.classes.length, 4);
  assert.equal(Object.keys(data.dals).length, 24);
  for (const d of Object.values(data.dals)) assert.equal(d.abilities.length, 5, d.name);
  for (const d of Object.values(data.dals).filter((x) => x.tier === 1)) assert.ok(ucDalStartBonus(d), d.name);
});

test("UC yaratma: sembol +2, dal bonusu, 2 serbest puan sembol stat'a gidemez, perk dönüşümü", () => {
  const ok = ucBuildCreation({ classKey: "close-quarter", dal: "brute", points: { goru: 1, giz: 1 }, perks: [] }, 0, data);
  assert.ok(ok.ok, ok.problems.join());
  assert.equal(ok.stats.yalman, 2);
  assert.equal(ok.stats.sebahat, 1); // Brute: +1 Sebahat
  const bad = ucBuildCreation({ classKey: "close-quarter", dal: "brute", points: { yalman: 2 }, perks: [] }, 0, data);
  assert.ok(!bad.ok);
  const wrongClass = ucBuildCreation({ classKey: "hunter", dal: "brute", points: { goru: 2 }, perks: [] }, 0, data);
  assert.ok(!wrongClass.ok);
  const neg = data.perks.find((p) => p.kind === "negative" && p.points === 3)!;
  const mixed = ucBuildCreation({ classKey: "close-quarter", dal: "brute", points: { yalman: 2, goru: 2 }, perks: [neg.key] }, 0, data);
  assert.ok(mixed.ok, mixed.problems.join());
  assert.equal(mixed.stats.yalman, 4);
});

test("UC perk bütçesi: negatif tavan uyarısı, birlikte alınamaz", () => {
  const negs = data.perks.filter((p) => p.kind === "negative").sort((a, b) => b.points - a.points);
  const many = ucPerkBudget([negs[0].key, negs[1].key], 0, data);
  assert.ok(many.gained > 10 ? many.warnings.length > 0 : true);
  assert.ok(ucPerkBudget(["polyglot", "monolingual"], 5, data).problems.some((p) => /birlikte/.test(p)));
});

test("UC yetenek puanı: katman kilidi, Sv 3 kilidi, Zirve", () => {
  const c = char();
  assert.equal(ucPoints(c, data).available[1], 1);
  const st = ucLearnState(c, "bonebreaker", data);
  assert.equal(st.state, "available");
  const lv2 = ucLearnState({ ...c, level: 1, abilities: { bonebreaker: 2 } }, "bonebreaker", data);
  assert.equal(lv2.state, "locked"); // 3. seviye en erken Sv 2
  const lv2ok = ucLearnState({ ...c, level: 2, abilities: { bonebreaker: 2 } }, "bonebreaker", data);
  assert.equal(lv2ok.state, "available");
  // K2 puanı K1'de harcanamaz: Sv 5'te K1 dolu (5/5) ise K1 yeteneği açılamaz
  const k1 = data.dals.brute.abilities;
  const full = Object.fromEntries(k1.slice(0, 3).map((k) => [k, 1]).concat([[k1[3], 2]]));
  const p = ucPoints({ level: 5, abilities: full }, data);
  assert.equal(p.available[1], 0);
  assert.equal(p.available[2], 1);
  const z = ucPoints({ level: 15, abilities: {} }, data);
  assert.equal(z.zirve, 1);
  assert.equal(z.unspent, 16);
  assert.deepEqual(ucOpenDalProblems({ ...c, level: 4 }, "arcanist", data).length > 0, true);
  assert.deepEqual(ucOpenDalProblems({ ...c, level: 5 }, "arcanist", data), []);
});

test("UC bonus tavanı ve zar parçaları", () => {
  assert.deepEqual([0, 4, 5, 9, 10, 14, 15].map(ucBonusCap), [4, 4, 5, 5, 6, 6, 7]);
  const c = char({ corruption: 7 });
  const r = ucCheckParts(c, { stat: "yalman", part: null, modifier: 6, magic: false, decay: true });
  assert.equal(r.bonus, 8); // 6 durum + 2 yoz
  assert.equal(r.overflow, 4);
  assert.equal(r.parts.find((x) => /Bonus/.test(x.label))?.value, 4);
  const pen = ucCheckParts(c, { stat: "yalman", part: null, modifier: -9, magic: false, decay: false });
  assert.equal(pen.parts.find((x) => x.label === "Ceza")?.value, -9); // cezanın tavanı yok
  const debt = ucCheckParts({ ...c, inspiration: -2 }, { stat: null, part: null, modifier: 0, magic: false, decay: false });
  assert.equal(debt.parts.find((x) => x.label === "Esin borcu")?.value, -4);
  const muhur = ucCheckParts({ ...c, uc: { forks: { "12": "direnis" } } }, { stat: null, part: null, modifier: 0, magic: true, decay: false });
  assert.equal(muhur.parts.find((x) => /Mühür/.test(x.label))?.value, -2);
});

test("UC yozlaşma: taban, çatal, yoz bonusu, Düşotu", () => {
  assert.deepEqual([0, 1, 6, 7, 12, 13].map(ucDecayDiceBonus), [0, 1, 1, 2, 2, 3]);
  assert.equal(ucDecayFloor({ "3": "teslim", "6": "direnis" }), 1);
  assert.equal(ucClampDecay(0, { "9": "teslim" }), 7);
  assert.equal(ucPendingFork(6, { "3": "direnis" }), "6");
  assert.equal(ucPendingFork(2, {}), null);
  assert.equal(ucDecayOutcome({ corruption: 10, uc: {} }, "dusotu", false).effect, "none");
  assert.equal(ucDecayOutcome({ corruption: 4, uc: { forks: { "6": "direnis" } } }, "dusotu", false).effect, "none");
  assert.equal(ucDecayOutcome({ corruption: 4, uc: {} }, "dusotu", false).next, 5);
  assert.equal(ucDecayOutcome({ corruption: 4, uc: { forks: { "3": "teslim" } } }, "arinma", true).next, 3);
  assert.equal(ucDecayOutcome({ corruption: 1, uc: { forks: { "3": "teslim" } } }, "arinma", true).effect, "none");
  const parts = ucDecayParts(char({ corruption: 7, stats: { ...ucEmptyStats(), sebahat: 3 } }), "dusotu", 0);
  assert.deepEqual(parts.map((p) => p.value), [3, -2]);
});

test("Diller: 50 SHZ dili, perk kuralı, GM temizliği", () => {
  assert.equal(SHZ_LANGUAGES.length, 50);
  assert.equal(new Set(SHZ_LANGUAGES).size, 50);
  assert.equal(languageSlots("SHZ", []), 2);
  assert.equal(languageSlots("SHZ", ["monolingual"]), 1);
  assert.equal(languageSlots("SHZ", ["trilingual"]), 3);
  assert.equal(languageSlots("UC", ["polyglot"]), 3);
  assert.deepEqual(languageProblems("SHZ", [], ["Türkçe", "Almanca"]), []);
  assert.ok(languageProblems("SHZ", [], ["Türkçe"]).length > 0);
  assert.ok(languageProblems("SHZ", [], ["Türkçe", "Klingonca"]).length > 0);
  assert.deepEqual(languageProblems("UC", [], []), []); // UC listesi yazım aşamasında
  assert.deepEqual(cleanLanguages([" Eski  Rün dili ", "eski rün dili", "Türkçe"]), ["Eski Rün dili", "Türkçe"]);
});
