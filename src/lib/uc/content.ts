import fs from "node:fs";
import path from "node:path";
import type { UcAbility, UcClass, UcContent, UcDal } from "./content-types";

// content/uc.json dosyasını okur ve önbelleğe alır (dosya değişirse yeniden okunur).
let cache: { mtime: number; data: UcContent; cls: Map<string, UcClass> } | null = null;

function load() {
  const f = path.join(process.cwd(), "content", "uc.json");
  const mtime = fs.statSync(f).mtimeMs;
  if (cache && cache.mtime === mtime) return cache;
  const data = JSON.parse(fs.readFileSync(f, "utf8")) as UcContent;
  cache = { mtime, data, cls: new Map(data.classes.map((c) => [c.key, c])) };
  return cache;
}

export function ucContent(): UcContent {
  return load().data;
}
export function ucClass(key: string): UcClass | undefined {
  return load().cls.get(key);
}
export function ucDal(key: string): UcDal | undefined {
  return load().data.dals[key];
}
export function ucAbility(key: string): UcAbility | undefined {
  return load().data.abilities[key];
}
/** Bir yeteneğin sayfadaki adresi. */
export function ucAbilityHref(a: Pick<UcAbility, "classKey" | "dalKey" | "key">) {
  return `/umbracaelis/kurallar/siniflar/${a.classKey}/${a.dalKey}#${a.key}`;
}
