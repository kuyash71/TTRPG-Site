/**
 * Arayüz çevirisi denetimi.
 *   npx tsx scripts/i18n-check.ts            sözlükte eksik anahtarlar + çevrilmemiş görünen Türkçe satırlar
 *   npx tsx scripts/i18n-check.ts <yol...>   yalnızca verilen dosya/klasörler
 * Anahtarlar: t("…"), bad/forbidden/conflict/notFound("…"), fmt("…"), tr("…") çağrılarındaki ilk düz metin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "../src/i18n/en";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const roots = args.length ? args.map((a) => path.resolve(a)) : [path.join(repo, "src"), path.join(repo, "server")];

function walk(p: string): string[] {
  if (!fs.existsSync(p)) return [];
  const st = fs.statSync(p);
  if (st.isFile()) return /\.(tsx?|mts)$/.test(p) ? [p] : [];
  return fs.readdirSync(p).flatMap((f) => walk(path.join(p, f)));
}

const KEY_RX = /\b(?:t|tt|tr|fmt|bad|forbidden|conflict|notFound|tLoose)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const TR = /[çğıöşüÇĞİÖŞÜ]/;
const missing = new Map<string, string[]>();
const suspects: string[] = [];
let keys = 0;

for (const f of roots.flatMap(walk)) {
  if (f.includes(`${path.sep}i18n${path.sep}`)) continue;
  const rel = path.relative(repo, f);
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(KEY_RX)) {
    if (m[1] === "`" && m[2].includes("${")) continue; // dinamik: şablon kullanılmalı
    const k = m[2].replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");
    if (!TR.test(k) && !/[a-zA-Z]/.test(k)) continue;
    keys++;
    if (!(k in EN)) missing.set(k, [...(missing.get(k) ?? []), rel]);
  }
  src.split("\n").forEach((line, i) => {
    const s = line.trim();
    if (!TR.test(s)) return;
    if (/^(\/\/|\*|\/\*|\{\/\*)/.test(s)) return; // yorum
    if (/\b(t|tt|fmt|bad|forbidden|conflict|notFound|tLoose)\(/.test(s)) return;
    if (/console\.(log|error|warn)/.test(s)) return;
    suspects.push(`${rel}:${i + 1}: ${s.slice(0, 140)}`);
  });
}

console.log(`${keys} çağrı, sözlükte eksik ${missing.size} anahtar.`);
for (const [k, files] of [...missing].slice(0, 400)) console.log(`  EKSİK "${k}"  ← ${[...new Set(files)].join(", ")}`);
console.log(`\nÇevrilmemiş olabilecek Türkçe satır: ${suspects.length}`);
for (const s of suspects.slice(0, args.length ? 2000 : 300)) console.log("  " + s);
process.exitCode = missing.size ? 1 : 0;
