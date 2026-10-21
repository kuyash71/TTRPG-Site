/**
 * Kural içeriğinin (content/*.json) İngilizce sürümü.
 *
 * Kaynak dosyalar Türkçedir ve kasadan üretilir (npm run sync / sync:uc). Çeviriler
 * content/i18n/memory.en.json içinde "Türkçe metnin özeti → İngilizce metin" olarak tutulur;
 * kaynak metin değişince yalnızca değişen parçaların çevirisi eksik kalır.
 *
 *   npx tsx scripts/i18n-content.ts build     content/<ad>.en.json dosyalarını üretir (eksikler Türkçe kalır)
 *   npx tsx scripts/i18n-content.ts extract   eksik çevirileri content/i18n/missing.en.json dosyasına yazar
 *   npx tsx scripts/i18n-content.ts merge <dosya.json>   {"özet": "çeviri"} ya da [{h, en}] çevirilerini belleğe ekler
 *   npx tsx scripts/i18n-content.ts stats     kapsama oranı
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = (f: string) => path.join(repo, "content", f);
const MEM = C("i18n/memory.en.json");
const MISSING = C("i18n/missing.en.json");
export const SOURCES = ["uc", "shz", "uc-tips", "tips"] as const;

/** Çevrilmeyen alanlar: anahtarlar, özel adlar, mantıkta kullanılan değerler. */
const SKIP = new Set([
  "key",
  "hash",
  "generatedAt",
  "searchText",
  "classKey",
  "dalKey",
  "stat",
  "kind",
  "tree",
  "prerequisite",
  "branch",
  "branchName",
  "emblem",
  "icon",
  "say",
  "type",
  "tier",
  "short",
]);
/** Dizi değerleri yalnızca bu anahtarlarda çevrilir (diğerleri anahtar listesidir). */
const ARRAYS = new Set(["match", "perkCategories"]);
const hasText = (s: string) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s);
export const hashOf = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 14);

function translatable(key: string, pathKeys: string[]) {
  if (SKIP.has(key)) return false;
  // Yetenek, perk, dal, sınıf, ağaç, augment ve kampanya adları özel addır; inanç adları ve seçenekleri çevrilir.
  if (key === "name") return pathKeys.includes("faiths");
  return true;
}

type Visit = (s: string) => string;
function walk(o: unknown, visit: Visit, key = "", pathKeys: string[] = []): unknown {
  if (typeof o === "string") return translatable(key, pathKeys) && hasText(o) ? visit(o) : o;
  if (Array.isArray(o)) {
    if (o.every((x) => typeof x === "string")) return ARRAYS.has(key) ? o.map((x) => (hasText(x) ? visit(x) : x)) : o;
    return o.map((x) => walk(x, visit, key, pathKeys));
  }
  if (o && typeof o === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = walk(v, visit, k, [...pathKeys, k]);
    // Arama metni çeviriden yeniden kurulur.
    if ("searchText" in out && typeof out.searchText === "string") out.searchText = plainOf(out);
    return out;
  }
  return o;
}
function plainOf(o: Record<string, unknown>): string {
  const parts: string[] = [];
  const grab = (v: unknown, k: string) => {
    if (k === "searchText" || k === "key" || SKIP.has(k)) return;
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach((x) => grab(x, ""));
    else if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) grab(vv, kk);
  };
  for (const [k, v] of Object.entries(o)) grab(v, k);
  return parts
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const readJson = <T>(f: string, d: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as T) : d);

function memory(): Record<string, string> {
  return readJson(MEM, {} as Record<string, string>);
}

function collect(): Map<string, string> {
  const all = new Map<string, string>();
  for (const s of SOURCES) {
    const f = C(`${s}.json`);
    if (!fs.existsSync(f)) continue;
    walk(readJson(f, {}), (x) => {
      all.set(hashOf(x), x);
      return x;
    });
  }
  return all;
}

const cmd = process.argv[2] ?? "build";
if (cmd === "build") {
  const mem = memory();
  let hit = 0;
  let miss = 0;
  for (const s of SOURCES) {
    const f = C(`${s}.json`);
    if (!fs.existsSync(f)) continue;
    const src = readJson<Record<string, unknown>>(f, {});
    const out = walk(src, (x) => {
      const en = mem[hashOf(x)];
      if (en !== undefined) {
        hit++;
        return en;
      }
      miss++;
      return x;
    }) as Record<string, unknown>;
    if ("hash" in out) out.hash = `${src.hash}-en`;
    fs.writeFileSync(C(`${s}.en.json`), JSON.stringify(out, null, 1) + "\n");
  }
  console.log(`İngilizce içerik üretildi: ${hit} çevrili, ${miss} eksik parça (eksikler Türkçe kalır).`);
  if (miss) console.log("Eksikleri görmek için: npx tsx scripts/i18n-content.ts extract");
} else if (cmd === "extract") {
  const mem = memory();
  const all = collect();
  const missing = [...all.entries()].filter(([h]) => !(h in mem)).map(([h, tr]) => ({ h, tr }));
  fs.mkdirSync(path.dirname(MISSING), { recursive: true });
  fs.writeFileSync(MISSING, JSON.stringify(missing, null, 1) + "\n");
  console.log(`${missing.length} eksik parça → content/i18n/missing.en.json`);
} else if (cmd === "merge") {
  const file = process.argv[3];
  if (!file) throw new Error("merge <dosya.json>");
  const mem = memory();
  const data = readJson<unknown>(path.resolve(file), {});
  const all = collect();
  let n = 0;
  const add = (h: string, en: string) => {
    if (!all.has(h)) return;
    mem[h] = en;
    n++;
  };
  if (Array.isArray(data)) for (const x of data as { h: string; en: string }[]) add(x.h, x.en);
  else for (const [h, en] of Object.entries(data as Record<string, string>)) add(h, en);
  fs.mkdirSync(path.dirname(MEM), { recursive: true });
  // kaynakta artık olmayan çeviriler budanır
  const pruned = Object.fromEntries(Object.entries(mem).filter(([h]) => all.has(h)).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MEM, JSON.stringify(pruned, null, 1) + "\n");
  console.log(`${n} çeviri eklendi; bellekte ${Object.keys(pruned).length} parça.`);
} else if (cmd === "stats") {
  const mem = memory();
  const all = collect();
  const done = [...all.keys()].filter((h) => h in mem).length;
  console.log(`${done}/${all.size} parça çevrili (%${Math.round((done / Math.max(1, all.size)) * 100)}).`);
}
