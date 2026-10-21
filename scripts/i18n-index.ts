/** src/i18n/en/*.json parçalarını tek bir sözlükte birleştiren src/i18n/en.ts dosyasını üretir. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "en");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const ids = files.map((f, i) => [`p${i}`, f] as const);
const out =
  "// Otomatik üretilir: npm run i18n:index. Sözlük parçaları src/i18n/en/*.json içindedir.\n" +
  ids.map(([id, f]) => `import ${id} from "./en/${f}";`).join("\n") +
  `\n\nexport const EN: Record<string, string> = Object.assign({}, ${ids.map(([id]) => id).join(", ")});\n`;
fs.writeFileSync(path.join(dir, "..", "en.ts"), out);
// çakışma kontrolü
const seen = new Map<string, string>();
let dup = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<string, string>;
  for (const [k, v] of Object.entries(d)) {
    if (seen.has(k) && seen.get(k) !== v) {
      dup++;
      if (dup < 30) console.log(`çakışma: "${k}" → "${seen.get(k)}" / "${v}" (${f})`);
    }
    seen.set(k, v);
  }
}
console.log(`${files.length} parça, ${seen.size} anahtar, ${dup} çakışma`);
