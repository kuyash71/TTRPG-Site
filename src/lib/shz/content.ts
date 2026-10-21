import fs from "node:fs";
import path from "node:path";
import type { Locale } from "../../i18n/core";
import type { Ability, Augment, Content, Perk, Tree } from "./content-types";

// content/shz.json dosyasını okur ve önbelleğe alır. Dosya değişirse
// (geliştirme sırasında npm run sync) bir sonraki çağrıda yeniden okunur.

interface Index {
  tree: Map<string, Tree>;
  perk: Map<string, Perk>;
  augment: Map<string, Augment>;
}
type Entry = { mtime: number; data: Content; idx: Index };
const caches = new Map<string, Entry>();

/** content/shz.json (Türkçe) ya da content/shz.en.json (İngilizce). */
function load(loc: Locale = "tr"): Entry {
  let f = path.join(process.cwd(), "content", loc === "en" ? "shz.en.json" : "shz.json");
  if (!fs.existsSync(f)) f = path.join(process.cwd(), "content", "shz.json");
  const mtime = fs.statSync(f).mtimeMs;
  const hit = caches.get(f);
  if (hit && hit.mtime === mtime) return hit;
  const data = JSON.parse(fs.readFileSync(f, "utf8")) as Content;
  const e: Entry = {
    mtime,
    data,
    idx: {
      tree: new Map(data.trees.map((t) => [t.key, t])),
      perk: new Map(data.perks.map((p) => [p.key, p])),
      augment: new Map(data.augments.map((a) => [a.key, a])),
    },
  };
  caches.set(f, e);
  return e;
}

export function content(loc: Locale = "tr"): Content {
  return load(loc).data;
}
export function getTree(key: string, loc: Locale = "tr"): Tree | undefined {
  return load(loc).idx.tree.get(key);
}
export function getAbility(key: string, loc: Locale = "tr"): Ability | undefined {
  return load(loc).data.abilities[key];
}
export function getPerk(key: string, loc: Locale = "tr"): Perk | undefined {
  return load(loc).idx.perk.get(key);
}
export function getAugment(key: string, loc: Locale = "tr"): Augment | undefined {
  return load(loc).idx.augment.get(key);
}

/** Kural motorunun ihtiyaç duyduğu içerik alt kümesi (istemciye de gönderilebilir). */
export interface RulesData {
  trees: Tree[];
  abilities: Record<string, Ability>;
  perks: Perk[];
  augments: Augment[];
}
export function rulesData(loc: Locale = "tr"): RulesData {
  const c = content(loc);
  return { trees: c.trees, abilities: c.abilities, perks: c.perks, augments: c.augments };
}
