import fs from "node:fs";
import path from "node:path";
import type { Locale } from "../../i18n/core";
import type { UcAbility, UcClass, UcContent, UcDal } from "./content-types";
import type { UcRules } from "./rules";

// content/uc.json (Türkçe) ya da content/uc.en.json (İngilizce) dosyasını okur ve önbelleğe alır
// (dosya değişirse yeniden okunur). İngilizce dosya `npx tsx scripts/i18n-content.ts build` ile üretilir.
type Entry = { mtime: number; data: UcContent; cls: Map<string, UcClass> };
const caches = new Map<string, Entry>();

function load(loc: Locale = "tr"): Entry {
  let f = path.join(process.cwd(), "content", loc === "en" ? "uc.en.json" : "uc.json");
  if (!fs.existsSync(f)) f = path.join(process.cwd(), "content", "uc.json");
  const mtime = fs.statSync(f).mtimeMs;
  const hit = caches.get(f);
  if (hit && hit.mtime === mtime) return hit;
  const data = JSON.parse(fs.readFileSync(f, "utf8")) as UcContent;
  const e = { mtime, data, cls: new Map(data.classes.map((c) => [c.key, c])) };
  caches.set(f, e);
  return e;
}

export function ucContent(loc: Locale = "tr"): UcContent {
  return load(loc).data;
}
export function ucClass(key: string, loc: Locale = "tr"): UcClass | undefined {
  return load(loc).cls.get(key);
}
export function ucDal(key: string, loc: Locale = "tr"): UcDal | undefined {
  return load(loc).data.dals[key];
}
export function ucAbility(key: string, loc: Locale = "tr"): UcAbility | undefined {
  return load(loc).data.abilities[key];
}
/** Bir yeteneğin sayfadaki adresi. */
export function ucAbilityHref(a: Pick<UcAbility, "classKey" | "dalKey" | "key">) {
  return `/umbracaelis/kurallar/siniflar/${a.classKey}/${a.dalKey}#${a.key}`;
}

/** Kural motoru ve istemci bileşenleri için sade veri (HTML metinleri olmadan). */
export function ucRulesData(loc: Locale = "tr"): UcRules {
  const c = load(loc).data;
  return {
    classes: c.classes.map((x) => ({ key: x.key, name: x.name, dals: x.dals })),
    dals: Object.fromEntries(
      Object.values(c.dals).map((d) => [d.key, { key: d.key, name: d.name, classKey: d.classKey, tier: d.tier, stat: d.stat, identity: d.identity, startBonusText: d.startBonusText, abilities: d.abilities }]),
    ),
    abilities: Object.fromEntries(
      Object.values(c.abilities).map((a) => [
        a.key,
        { key: a.key, name: a.name, classKey: a.classKey, dalKey: a.dalKey, tier: a.tier, type: a.type, maxLevel: a.maxLevel, signature: a.signature, requirements: a.requirements, requirementText: a.requirementText },
      ]),
    ),
    perks: c.perks.map((p) => ({ key: p.key, name: p.name, kind: p.kind, points: p.points, category: p.category, exclusive: p.exclusive })),
  };
}
