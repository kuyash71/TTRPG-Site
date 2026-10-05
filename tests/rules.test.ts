import assert from "node:assert/strict";
import { test } from "node:test";
import { rulesData } from "../src/lib/shz/content";
import { enrichContent } from "../src/lib/base";
import { buildCreation, checkModifiers, clampCorruption, effectiveStats, emptyStats, learnState, normalizeBody, perkBudget, refundPlan, woundPenalty, type CharLike } from "../src/lib/shz/rules";

const data = rulesData();

function char(over: Partial<CharLike> = {}): CharLike {
  return { level: 0, stats: { ...emptyStats(), klang: 2 }, trees: ["ubermann"], abilities: {}, perks: [], body: {}, corruption: 0, inspiration: 0, abilityPoints: 1, ...over };
}

test("içerik: 7 ağaç, her biri 8 yetenek, 30/30 perk", () => {
  assert.equal(data.trees.length, 7);
  for (const t of data.trees) assert.equal(t.abilities.length, 8, t.name);
  assert.equal(data.perks.filter((p) => p.kind === "positive").length, 30);
  assert.equal(data.perks.filter((p) => p.kind === "negative").length, 30);
});

test("yaratma: ağaç +2, Klang 2, sınıf bonusu, 2 serbest puan ağaç stat'ına gidemez", () => {
  const ok = buildCreation({ tree: "ubermann", points: { aim: 1, sanita: 1 }, perks: [], startAugment: null, firstAbility: null }, 0, data);
  assert.ok(ok.ok, ok.problems.join());
  assert.equal(ok.stats.korp, 2);
  assert.equal(ok.stats.krach, 1);
  assert.equal(ok.stats.klang, 2);
  const bad = buildCreation({ tree: "ubermann", points: { korp: 2 }, perks: [], startAugment: null, firstAbility: null }, 0, data);
  assert.ok(!bad.ok);
  // perklerden gelen puan ağaç stat'ına gidebilir
  const neg = data.perks.find((p) => p.kind === "negative" && p.points === 3)!; // +3 -> (3+1)/2 = 2
  const mixed = buildCreation({ tree: "ubermann", points: { korp: 2, aim: 2 }, perks: [neg.key], startAugment: null, firstAbility: null }, 0, data);
  assert.ok(mixed.ok, mixed.problems.join());
  assert.equal(mixed.stats.korp, 4);
  const over = buildCreation({ tree: "ubermann", points: { korp: 3, aim: 1 }, perks: [neg.key], startAugment: null, firstAbility: null }, 0, data);
  assert.ok(!over.ok);
});

test("perk bütçesi: negatife düşemez, artan (p+1)/2 aşağı", () => {
  const neg = data.perks.find((p) => p.kind === "negative" && p.points === 3)!;
  const b = perkBudget([neg.key], 2, data);
  assert.equal(b.left, 5);
  assert.equal(b.convertible, 3);
  const pos = data.perks.find((p) => p.kind === "positive" && p.points === 10)!;
  assert.ok(perkBudget([pos.key], 2, data).problems.length > 0);
  assert.equal(perkBudget([], 0, data).convertible, 0);
  assert.equal(perkBudget([], 1, data).convertible, 1);
});

test("perk dışlaması", () => {
  const p = data.perks.find((x) => x.exclusive.length)!;
  const b = perkBudget([p.key, p.exclusive[0]], 30, data);
  assert.ok(b.problems.some((x) => x.includes("birlikte")));
});

test("Metallkorp başlangıç augment'i ve Klang etkisi", () => {
  const r = buildCreation({ tree: "metallkorp", points: { korp: 1, werk: 1 }, perks: [], startAugment: { key: "glasauge", part: "head" }, firstAbility: null }, 0, data);
  assert.ok(r.ok, r.problems.join());
  const eff = effectiveStats({ stats: r.stats, body: r.body, corruption: 0 }, data);
  assert.equal(eff.klang.value, 3); // 2 + 2 ağaç − 1 Glasauge
  assert.equal(eff.sicht.value, 2);
  const wrong = buildCreation({ tree: "metallkorp", points: { korp: 1, werk: 1 }, perks: [], startAugment: { key: "glasauge", part: "l-arm" }, firstAbility: null }, 0, data);
  assert.ok(!wrong.ok);
});

test("yetenek: öncül, stat, seviye şartı ve 3. seviye kuralı", () => {
  const titan = data.abilities["titan"];
  assert.equal(learnState(char(), "titan", data).state, "locked");
  const strong = char({ level: 7, stats: { ...emptyStats(), korp: 7, krach: 5, klang: 2 }, abilities: { [titan.prerequisite!]: 1 } });
  assert.equal(learnState(strong, "titan", data).state, "available");
  const three = Object.values(data.abilities).find((a) => a.maxLevel === 3 && !a.prerequisite && a.requirements.length === 0)!;
  const c = char({ trees: [three.tree], abilities: { [three.key]: 2 }, abilityPoints: 1, level: 3 });
  const st = learnState(c, three.key, data);
  assert.equal(st.state, "locked");
  assert.ok(st.state === "locked" && st.problems.some((p) => p.includes("3. seviye")));
  assert.equal(learnState({ ...c, level: 4 }, three.key, data).state, "available");
});

test("yara cezası ve sargı", () => {
  assert.equal(woundPenalty({ wound: "agir", bandage: "yok" }), 5);
  assert.equal(woundPenalty({ wound: "agir", bandage: "temiz" }), 2);
  assert.equal(woundPenalty({ wound: "agir", bandage: "kirli" }), 3);
  assert.equal(woundPenalty({ wound: "saglam", bandage: "yok" }), 0);
});

test("zar düzenleyicileri: negatif Klang ve Inspiration borcu", () => {
  const body = normalizeBody({});
  body["r-hand"].wound = "hafif";
  const c = char({ stats: { ...emptyStats(), korp: 4, klang: -2 }, inspiration: -1, body });
  const parts = checkModifiers(c, { stat: "korp", part: "r-hand", modifier: 1, blackMagic: false }, data);
  const sum = parts.reduce((a, b) => a + b.value, 0);
  assert.equal(sum, 4 - 2 - 2 - 2 + 1);
});

test("Corruption 7 kilidi", () => {
  assert.deepEqual(clampCorruption(8, false), { value: 8, locked: true });
  assert.deepEqual(clampCorruption(3, true), { value: 7, locked: true });
  assert.deepEqual(clampCorruption(20, false), { value: 13, locked: true });
});

test("Perk stat etkileri ve negatif statlar yansır", () => {
  const intro = data.perks.find((p) => p.key === "introvert")!;
  const schizo = data.perks.find((p) => p.key === "schizo")!;
  assert.deepEqual(intro.mods, [{ stat: "rede", value: -2 }]);
  assert.equal(schizo.mods.length, 2);
  const stats = { ...emptyStats(), rede: 1, leis: 0, klang: 2 };
  const eff = effectiveStats({ stats, body: {}, corruption: 0, perks: ["introvert", "schizo"] }, data);
  assert.equal(eff.rede.value, -3); // 1 − 2 − 2: 0'da kesilmez
  assert.equal(eff.leis.value, -2);
  assert.ok(eff.rede.parts.some((p) => p.label === intro.name));
  // Koşullu etkiler (zarlarına −2) sabit stat etkisi sayılmaz
  assert.deepEqual(data.perks.find((p) => p.key === "kurzsichtig")!.mods, []);
});

test("Augment olumsuz etkisi 0'ın altına düşürür", () => {
  const fed = data.augments.find((a) => a.key === "federfuss")!;
  const body = { "l-foot": { wound: "saglam", bandage: "yok", augment: fed.key, note: "" } } as never;
  const eff = effectiveStats({ stats: emptyStats(), body, corruption: 0 }, data);
  assert.equal(eff.korp.value, -1);
});

test("GM iadesi: sabit değerler korunur, kalan puanlar döner", () => {
  // Ubermann: ağaç stat'ı Korp (+2), başlangıç bonusu Krach +1
  const stats = { ...emptyStats(), klang: 3, korp: 2 + 3 + 1, krach: 2, rede: 2 };
  const plan = refundPlan({ stats, trees: ["ubermann", data.trees.find((t) => t.key !== "ubermann")!.key], abilities: { a: 2, b: 1 }, level: 3 }, data);
  assert.equal(plan.stats.korp, 5); // 2 + seviye başına 1
  assert.equal(plan.stats.krach, 1);
  assert.equal(plan.stats.klang, 2);
  assert.equal(plan.stats.rede, 0);
  assert.equal(plan.statPoints, 1 + 1 + 1 + 2);
  assert.equal(plan.abilityPoints, 3 + 1);
  assert.deepEqual(plan.trees, ["ubermann"]);
});

test("İçerik zenginleştirme stat etkilerini işaretler", () => {
  const h = enrichContent("<p>+2 Rede ve -1 Korp; d20 + Krach</p>");
  assert.match(h, /stat-mod pos">\+2 Rede/);
  assert.match(h, /stat-mod neg">−1 Korp/);
  assert.match(h, /class="dice">d20/);
  assert.match(h, /class="stat-name" data-tip-kind="stats" data-tip-key="krach"[^>]*>Krach/);
});

test("İçerik zenginleştirme sözlük terimlerini tıklanabilir yapar", () => {
  const h = enrichContent('<p>Corruption artar, Cower olursun; Death Save Throw atarsın. <a href="#x">Ubermann</a></p>');
  assert.match(h, /data-tip-key="corruption"[^>]*>Corruption</);
  assert.match(h, /data-tip-key="cower"[^>]*>Cower</);
  assert.match(h, /data-tip-key="death-save"[^>]*>Death Save Throw</);
  assert.doesNotMatch(h, /data-tip-key="uber"/);
});

test("ipuçları: tüm yetenek, augment, perk ve ağaçların Türkçe karşılığı var", async () => {
  const { tipFor } = await import("../src/lib/shz/tips");
  for (const k of Object.keys(data.abilities)) assert.ok(tipFor("abilities", k)?.meaning, k);
  for (const a of data.augments) assert.ok(tipFor("augments", a.key)?.summary, a.key);
  for (const p of data.perks) assert.ok(tipFor("perks", p.key)?.summary, p.key);
  for (const t of data.trees) assert.ok(tipFor("trees", t.key)?.summary, t.key);
});

// ---- Kriegsversehrt ve başlangıç augment'i
import { amputationPlan as _amp, kriegsversehrtLimbs as _kl } from "../src/lib/shz/rules";

const KV = (amputation: string[] | null, extra: Partial<Parameters<typeof buildCreation>[0]> = {}) =>
  buildCreation({ tree: "ubermann", points: {}, perks: ["kriegsversehrt"], startAugment: null, firstAbility: null, amputation, ...extra }, 0, data);

test("Kriegsversehrt: tek uzuv +4, iki uzuv +7; kol → el, bacak → ayak", () => {
  const one = KV(["l-arm"]);
  assert.equal(one.budget.gained, 4);
  assert.equal(one.body["l-arm"].wound, "kopuk");
  assert.equal(one.body["l-hand"].wound, "kopuk");
  assert.equal(one.body["r-arm"].wound, "saglam");
  assert.equal(_kl(one.body), 1);
  const two = KV(["l-hand", "r-leg"]);
  assert.equal(two.budget.gained, 7);
  assert.deepEqual(["l-hand", "r-leg", "r-foot"].map((k) => two.body[k as "l-hand"].wound), ["kopuk", "kopuk", "kopuk"]);
  assert.equal(two.body["l-arm"].wound, "saglam");
  assert.equal(_kl(two.body), 2);
  // tek uzuv: 4 puan → (4+1)/2 = 2 stat puanı; serbest 2 ile toplam 4
  const full = KV(["r-foot"], { points: { aim: 2, sicht: 2 } });
  assert.ok(full.ok, full.problems.join());
});

test("Kriegsversehrt: geçersiz seçimler", () => {
  assert.ok(KV([]).problems.some((p) => p.includes("seçilmeli")));
  assert.ok(KV(null).problems.some((p) => p.includes("seçilmeli")));
  assert.ok(KV(["head"]).problems.length > 0);
  assert.ok(KV(["upper-torso"]).problems.length > 0);
  assert.ok(KV(["l-arm", "l-hand"]).problems.some((p) => p.includes("zaten kopuk")));
  assert.ok(KV(["l-arm", "r-arm", "l-leg"]).problems.some((p) => p.includes("En fazla")));
  assert.equal(_amp(["l-leg"]).parts.join(","), "l-leg,l-foot");
  const noPerk = buildCreation({ tree: "ubermann", points: {}, perks: [], startAugment: null, firstAbility: null, amputation: ["l-arm"] }, 0, data);
  assert.ok(noPerk.problems.some((p) => p.includes("yalnızca Kriegsversehrt")));
  // eski kayıtlar (işaretsiz): içerikteki puan
  assert.equal(perkBudget(["kriegsversehrt"], 0, data, { limbs: _kl({}) }).gained, 7);
});

test("Metallkorp: başlangıç augment'i ve kopuk uzuv etkileşimi", () => {
  const base = { tree: "metallkorp", points: {}, perks: ["kriegsversehrt"], firstAbility: null };
  const blocked = buildCreation({ ...base, amputation: ["l-arm"], startAugment: { key: "stahlfinger", part: "l-hand" } }, 0, data);
  assert.ok(blocked.problems.some((p) => p.includes("kopuk olduğu için")));
  const prosthesis = buildCreation({ ...base, amputation: ["r-foot"], startAugment: { key: "federfuss", part: "r-foot" } }, 0, data);
  assert.ok(!prosthesis.problems.some((p) => /augment/i.test(p)), prosthesis.problems.join());
  assert.equal(prosthesis.body["r-foot"].augment, "federfuss");
  assert.equal(prosthesis.body["r-foot"].wound, "saglam");
  const none = buildCreation({ tree: "metallkorp", points: {}, perks: [], firstAbility: null, startAugment: null }, 0, data);
  assert.ok(none.problems.some((p) => p.includes("augment'i seçilmeli")));
});
