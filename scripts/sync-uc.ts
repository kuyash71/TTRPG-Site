/**
 * Umbra Caelis kasasındaki TTRPG dosyalarını (Ucaelis-TTRPG) okuyup
 * content/uc.json dosyasını üretir. Site bu dosyayı umbracaelis.com/umbracaelis/kurallar
 * altında gösterir.
 *
 * Kullanım:   npm run sync:uc
 *             npm run sync:uc -- --vault "C:/Users/.../Umbra-Caelis/Ucaelis-TTRPG"
 *             npm run sync:uc -- --check     (dosya yazmadan doğrular)
 *
 * Varsayılan yol: Writing/Shwarzesonne/Codex/_Web/TTRPG-Site → Writing/Umbra-Caelis/Ucaelis-TTRPG
 * Okunan klasörler: System, Classes, Perks. Old-Sheets ve Web okunmaz.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UC_BASE, ucStatFromLabel, type UcStatKey } from "../src/lib/uc/constants";
import type { UcAbility, UcClass, UcContent, UcDal, UcDoc, UcPerk, UcRequirement, UcSection } from "../src/lib/uc/content-types";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const CHECK_ONLY = process.argv.includes("--check");
const VAULT = path.resolve(arg("--vault") || process.env.UC_VAULT_DIR || path.resolve(repo, "..", "..", "..", "..", "Umbra-Caelis", "Ucaelis-TTRPG"));
const SYS = path.join(VAULT, "System");
const CLASSES = path.join(VAULT, "Classes");
const PERKS = path.join(VAULT, "Perks");
const OUT = path.join(repo, "content", "uc.json");

const CLASS_ORDER = ["Close-Quarter", "Hunter", "Priest", "Scholar"];
const DOC_ORDER: [string, string][] = [
  ["Core.md", "Temel Kurallar"],
  ["Character.md", "Karakter"],
  ["Body.md", "Beden ve Yaralar"],
  ["Mana.md", "Mana"],
  ["Yozlaşma.md", "Yozlaşma"],
];

const warnings: string[] = [];
const errors: string[] = [];
const warn = (m: string) => warnings.push(m);
const fail = (m: string) => errors.push(m);

// ---------------------------------------------------------------- yardımcılar
function read(p: string) {
  return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").normalize("NFC");
}
function norm(s: string) {
  return s.replace(/İ/g, "i").toLowerCase().replace(/\u0307/g, "");
}
export function slug(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", ä: "a", ß: "ss", é: "e", í: "i", á: "a", ó: "o", ú: "u", ñ: "n" };
  return norm(s.normalize("NFC"))
    .replace(/[çğıöşüäßéíáóúñ]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function plain(h: string) {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out.sort();
}
const stem = (p: string) => path.basename(p).replace(/\.md$/i, "").normalize("NFC");
const dirs = (p: string) =>
  fs.existsSync(p)
    ? fs
        .readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name.normalize("NFC"))
        .sort()
    : [];

// [[bağlantı]] hedefleri: isim (ya da yol) -> { href, label }
const LINKS = new Map<string, { href: string; label: string }>();
const linkKey = (s: string) => s.trim().replace(/\\$/, "").replace(/\.md$/i, "").normalize("NFC");

function inline(src: string): string {
  let s = esc(src);
  s = s.replace(/!\[\[[^\]]+\]\]/g, "");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const [targetRaw, alias] = inner.split(/\\?\|/).map((x) => x.trim());
    const target = linkKey(targetRaw);
    const l = LINKS.get(target) ?? LINKS.get(target.split("/").pop() ?? "");
    const label = alias || l?.label || target.split("/").pop() || target;
    if (!l) {
      warn(`Çözülemeyen bağlantı (düz metin kaldı): [[${target}]]`);
      return label;
    }
    return `<a href="${l.href}">${label}</a>`;
  });
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "<em>$1</em>");
  s = s.replace(/-&gt;/g, "→").replace(/&gt;=/g, "≥").replace(/&lt;=/g, "≤");
  // Eşik tablosu: { Çok Kolay 7 / Kolay 9 / ... } → küçük rozetler
  s = s.replace(/\{\s*((?:[^{}\/]+?\s\d+\s*\/\s*)+[^{}\/]+?\s\d+)\s*\}/g, (_m, body: string) =>
    '<span class="thresholds">' +
    body
      .split("/")
      .map((x) => {
        const m = /^(.*?)\s+(\d+)$/.exec(x.trim());
        return m ? `<span class="thr"><span>${m[1]}</span><b>${m[2]}</b></span>` : x;
      })
      .join("") +
    "</span>",
  );
  return s;
}

const HEAD = /^(#{1,6})\s+(.*?)\s*$/;
const isTab = (l: string) => (l.startsWith("\t") || l.startsWith("    ")) && l.trim() !== "" && !/^\s*([-*]|\d+\.)\s/.test(l);
const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function splitRow(l: string) {
  // Obsidian tablolarında bağlantı içindeki \| hücre ayırıcı değildir.
  const cells: string[] = [];
  let cur = "";
  const t = l.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\\" && t[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (t[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += t[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** Kasa Markdown'ını güvenli HTML'e çevirir (tüm metin kaçışlanır). */
function md(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  const para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push("<p>" + para.map((x) => inline(x.trim())).join("<br>") + "</p>");
      para.length = 0;
    }
  };
  const nextNb = (j: number) => {
    while (j < lines.length && !lines[j].trim()) j++;
    return j;
  };
  const emptyHead = (j: number, level: number): [string, number] | null => {
    const m = j < lines.length ? HEAD.exec(lines[j]) : null;
    if (!m || m[1].length !== level) return null;
    const k = nextNb(j + 1);
    if (k >= lines.length || HEAD.test(lines[k])) return [m[2], k];
    return null;
  };
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) {
      flush();
      i++;
      continue;
    }
    if (/^\s*```/.test(ln)) {
      flush();
      const block: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) block.push(lines[i++]);
      i++;
      out.push(`<pre class="code">${esc(block.join("\n"))}</pre>`);
      continue;
    }
    const m = HEAD.exec(ln);
    if (m) {
      flush();
      const run: string[] = [];
      let j = i;
      for (;;) {
        const r = emptyHead(j, m[1].length);
        if (!r) break;
        run.push(r[0]);
        j = r[1];
      }
      if (run.length >= 3) {
        out.push('<div class="chips">' + run.map((x) => `<span class="chip">${inline(x)}</span>`).join("") + "</div>");
        i = j;
        continue;
      }
      const tag = m[1].length <= 2 ? "h2" : m[1].length === 3 ? "h3" : "h4";
      out.push(`<${tag}>${inline(m[2].replace(/:+$/, ""))}</${tag}>`);
      i++;
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(ln)) {
      flush();
      if (out.length && !out[out.length - 1].startsWith("<hr")) out.push("<hr>");
      i++;
      continue;
    }
    if (isTableRow(ln)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitRow(lines[i++]);
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        rows.push(cells);
      }
      const [head, ...body] = rows;
      out.push(
        '<div class="table-wrap"><table class="uc-table"><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>" +
          body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    if (LIST.test(ln) && !isTab(ln)) {
      flush();
      // iç içe listeler: girintiye göre
      const items: { depth: number; ordered: boolean; text: string }[] = [];
      while (i < lines.length && LIST.test(lines[i])) {
        const lm = LIST.exec(lines[i])!;
        const depth = lm[1].replace(/\t/g, "    ").length >= 2 ? 1 : 0;
        items.push({ depth, ordered: /\d/.test(lm[2]), text: lm[3] });
        i++;
      }
      let html = "";
      const stack: string[] = [];
      let prevDepth = -1;
      for (const it of items) {
        const tag = it.ordered ? "ol" : "ul";
        if (it.depth > prevDepth) {
          html += `<${tag}>`;
          stack.push(tag);
        } else {
          html += "</li>";
          while (it.depth < prevDepth) {
            html += `</${stack.pop()}></li>`;
            prevDepth--;
          }
        }
        html += `<li>${inline(it.text)}`;
        prevDepth = it.depth;
      }
      html += "</li>";
      while (stack.length) {
        html += `</${stack.pop()}>`;
        if (stack.length) html += "</li>";
      }
      out.push(html);
      continue;
    }
    if (isTab(ln)) {
      flush();
      const block: string[] = [];
      while (i < lines.length && isTab(lines[i])) block.push(lines[i++]);
      const nxt = i < lines.length ? lines[i] : "";
      if (block.length === 1 && nxt.trim() && !isTab(nxt)) {
        out.push(`<h4 class="label">${inline(block[0].trim())}</h4>`);
      } else if (block.length > 1 && block.every((b) => /^\s*[^:{}]{1,40}:\s*\S/.test(b))) {
        const rows = block
          .map((b) => {
            const t = b.trim();
            const k = t.slice(0, t.indexOf(":"));
            const v = t.slice(t.indexOf(":") + 1);
            return `<tr><th>${inline(k.trim())}</th><td>${inline(v.trim())}</td></tr>`;
          })
          .join("");
        out.push(`<table class="kv">${rows}</table>`);
      } else {
        out.push(`<div class="formula">${block.map((b) => `<div>${inline(b.trim())}</div>`).join("")}</div>`);
      }
      continue;
    }
    para.push(ln);
    i++;
  }
  flush();
  // Baştaki/sondaki ayırıcılar anlamsız
  while (out[0] === "<hr>") out.shift();
  while (out[out.length - 1] === "<hr>") out.pop();
  return out.join("\n");
}

/** "#### BAŞLIK" ile bölünmüş bölümler (ilk parça başlıksız giriş metnidir). */
function sections(text: string, re: RegExp): { intro: string; secs: [string, string][] } {
  const parts = text.split(re);
  const secs: [string, string][] = [];
  for (let k = 1; k < parts.length; k += 2) secs.push([parts[k].trim().replace(/:+$/, "").trim().toLocaleUpperCase("tr-TR"), (parts[k + 1] ?? "").trim()]);
  return { intro: parts[0].trim(), secs };
}
function fieldsOf(t: string) {
  const f: Record<string, string> = {};
  for (const fm of t.matchAll(/^\*\*([A-ZÇĞİÖŞÜ ]+)\*\*:\s*(.*)$/gm)) f[fm[1].trim()] = fm[2].trim();
  return f;
}
const stripFields = (t: string) =>
  t
    .replace(/^\*\*[A-ZÇĞİÖŞÜ ]+\*\*:.*$/gm, "")
    .replace(/^\s*-{3,}\s*$/gm, "")
    .trim();
const titleCase = (k: string) => k.charAt(0) + k.slice(1).toLocaleLowerCase("tr-TR");

// ---------------------------------------------------------------- toplama
if (!fs.existsSync(SYS) || !fs.existsSync(CLASSES)) {
  console.error(`Umbra Caelis kasası bulunamadı: ${VAULT}\n--vault ile Ucaelis-TTRPG klasörünün yolunu ver.`);
  process.exit(1);
}

interface RawDal {
  folder: string;
  name: string;
  key: string;
  tier: 1 | 2 | 3;
  stat: UcStatKey | null;
  identity: string;
  text: string;
  abilities: { path: string; name: string; key: string; text: string; fields: Record<string, string> }[];
}
interface RawClass {
  folder: string;
  name: string;
  key: string;
  text: string;
  dals: RawDal[];
}

const rawClasses: RawClass[] = [];
for (const cf of dirs(CLASSES)) {
  const cdir = path.join(CLASSES, cf);
  const clsFile = path.join(cdir, "a.CLASS.md");
  if (!fs.existsSync(clsFile)) {
    fail(`Sınıf dosyası yok: ${cf}/a.CLASS.md`);
    continue;
  }
  const ctext = read(clsFile);
  const cname = fieldsOf(ctext)["ANA SINIF"] || cf;
  // Katman tablosu: | K1 | [[...|Brute]] | Yalman | Kimlik |
  const table: { tier: 1 | 2 | 3; label: string; target: string; stat: UcStatKey | null; identity: string }[] = [];
  for (const ln of ctext.split("\n")) {
    if (!isTableRow(ln)) continue;
    const cells = splitRow(ln);
    const tm = /^K([123])$/.exec(cells[0] ?? "");
    if (!tm) continue;
    const lm = /\[\[([^\]]+)\]\]/.exec(cells[1] ?? "");
    const [target, alias] = lm ? lm[1].split(/\\?\|/).map((x) => x.trim()) : [cells[1], cells[1]];
    table.push({ tier: Number(tm[1]) as 1, label: (alias || target).trim(), target: linkKey(target), stat: ucStatFromLabel(cells[2] ?? ""), identity: (cells[3] ?? "").trim() });
  }
  const dalsRaw: RawDal[] = [];
  for (const tf of dirs(cdir)) {
    const tm = /^T([123])$/.exec(tf);
    if (!tm) continue;
    const tier = Number(tm[1]) as 1 | 2 | 3;
    for (const df of dirs(path.join(cdir, tf))) {
      const ddir = path.join(cdir, tf, df);
      const files = walk(ddir);
      if (!files.length) continue; // boş klasör (ör. bozuk kopyalanmış "Men of Will")
      // Klasör adı tablodaki addan kısa olabilir ("Men" → "Men of Will").
      const row =
        table.find((r) => r.tier === tier && r.label === df) ??
        table.find((r) => r.tier === tier && r.label.startsWith(df + " ")) ??
        table.find((r) => r.tier === tier && r.target.split("/").includes(df));
      if (!row) warn(`${cname}/${tf}/${df}: a.CLASS katman tablosunda bulunamadı`);
      else if (row.label !== df) warn(`${cname}/${tf}: klasör adı "${df}", tablodaki dal adı "${row.label}" (klasörü yeniden adlandırman önerilir)`);
      const name = row?.label ?? df;
      const dalFile = files.find((f) => path.basename(f).startsWith("a.DAL"));
      const dtext = dalFile ? read(dalFile) : "";
      if (!dalFile) warn(`${cname}/${name}: a.DAL.md yok`);
      const df_ = fieldsOf(dtext);
      let stat = row?.stat ?? null;
      const fstat = (df_["SEMBOL STAT"] ?? "")
        .split(/\s+/)
        .map((w) => ucStatFromLabel(w))
        .find(Boolean);
      if (!stat) stat = fstat ?? null;
      if (stat && fstat && stat !== fstat) warn(`${cname}/${name}: sembol stat tabloda ve a.DAL'da farklı`);
      if (!stat) fail(`${cname}/${name}: sembol stat okunamadı`);
      const abilities = files
        .filter((f) => !path.basename(f).startsWith("a."))
        .map((f) => {
          const t = read(f);
          return { path: f, name: stem(f), key: slug(stem(f)), text: t, fields: fieldsOf(t) };
        });
      dalsRaw.push({ folder: df, name, key: slug(name), tier, stat, identity: row?.identity ?? "", text: dtext, abilities });
      if (row) LINKS.set(row.target, { href: `${UC_BASE}/siniflar/${slug(cname)}/${slug(name)}`, label: name });
    }
  }
  dalsRaw.sort((a, b) => a.tier - b.tier || table.findIndex((r) => r.label === a.name) - table.findIndex((r) => r.label === b.name));
  rawClasses.push({ folder: cf, name: cname, key: slug(cname), text: ctext, dals: dalsRaw });
  LINKS.set(`Classes/${cf}/a.CLASS`, { href: `${UC_BASE}/siniflar/${slug(cname)}`, label: cname });
}
rawClasses.sort((a, b) => {
  const ia = CLASS_ORDER.indexOf(a.name);
  const ib = CLASS_ORDER.indexOf(b.name);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
});

interface RawPerk {
  stem: string;
  name: string;
  key: string;
  points: number;
  kind: "positive" | "negative";
  text: string;
}
const rawPerks: RawPerk[] = [];
for (const [folder, kind] of [
  ["Positive", "positive"],
  ["Negative", "negative"],
] as const) {
  for (const f of walk(path.join(PERKS, folder))) {
    const s = stem(f);
    const m = /^\(\s*([+-])\s*(\d+)\s*\)\s*(.+)$/.exec(s);
    if (!m) {
      fail(`Perk dosya adı "( ± N ) İsim" biçiminde değil: ${s}`);
      continue;
    }
    if ((m[1] === "-") !== (kind === "positive")) warn(`Perk ${s}: işaret klasörle uyuşmuyor (${folder})`);
    const name = m[3].trim();
    rawPerks.push({ stem: s, name, key: slug(name), points: Number(m[2]), kind, text: read(f) });
  }
}

// bağlantı tablosu
for (const c of rawClasses)
  for (const d of c.dals)
    for (const a of d.abilities) LINKS.set(a.name, { href: `${UC_BASE}/siniflar/${c.key}/${d.key}#${a.key}`, label: a.name });
for (const p of rawPerks) {
  const l = { href: `${UC_BASE}/perkler#${p.key}`, label: p.name };
  LINKS.set(p.stem, l);
  LINKS.set(p.name, l);
}
for (const [fn, title] of DOC_ORDER) LINKS.set(fn.replace(/\.md$/, ""), { href: `${UC_BASE}/${slug(title)}`, label: title });
// Stats.md henüz yok: statlar sözlükte listelenir.
if (!fs.existsSync(path.join(SYS, "Stats.md"))) {
  LINKS.set("Stats", { href: `${UC_BASE}/sozluk#statlar`, label: "Statlar" });
  warn("System/Stats.md yok: [[Stats]] bağlantıları sözlükteki stat listesine gider.");
}

// ---------------------------------------------------------------- dönüştürme
function parseRequirements(txt: string, where: string): UcRequirement[] {
  const out: UcRequirement[] = [];
  if (!txt || /^yok$/i.test(txt.trim())) return out;
  for (const raw of txt.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    let m: RegExpExecArray | null;
    if ((m = /^Sv\.?\s*(\d+)$/i.exec(part))) out.push({ kind: "level", min: Number(m[1]) });
    else if ((m = /^Yozlaşma\s+en az\s+(\d+)$/i.exec(part))) out.push({ kind: "decayMin", min: Number(m[1]) });
    else if ((m = /^Yozlaşma\s+en fazla\s+(\d+)$/i.exec(part))) out.push({ kind: "decayMax", max: Number(m[1]) });
    else if ((m = /^(\S+)\s+(\d+)$/.exec(part)) && ucStatFromLabel(m[1])) out.push({ kind: "stat", stat: ucStatFromLabel(m[1])!, min: Number(m[2]) });
    else {
      warn(`${where}: gereksinim tanınmadı, metin olarak kaldı: "${part}"`);
      out.push({ kind: "text", text: part });
    }
  }
  return out;
}

const SECTION_LABELS: Record<string, string> = { ETKİ: "Etki", BEDEL: "Bedel", NOT: "Not", SİNERJİ: "Sinerji", "ÖN KOŞUL": "Ön koşul" };
const nameToKey = new Map<string, string>();
for (const c of rawClasses) for (const d of c.dals) for (const a of d.abilities) nameToKey.set(a.name, a.key);

const abilities: Record<string, UcAbility> = {};
const dals: Record<string, UcDal> = {};
const classes: UcClass[] = [];

for (const c of rawClasses) {
  const dalKeys: string[] = [];
  for (const d of c.dals) {
    const order: { key: string; sort: [number, number, string] }[] = [];
    for (const a of d.abilities) {
      const f = a.fields;
      const where = `${c.name}/${d.name}/${a.name}`;
      for (const req of ["SINIF", "DAL", "TİP", "GEREKSİNİM", "SEVİYELER"]) if (!(req in f)) warn(`${where}: ${req} alanı eksik`);
      if (f["SINIF"] && f["SINIF"] !== c.name) warn(`${where}: SINIF alanı "${f["SINIF"]}"`);
      const dm = /^(.*?)\s*\(K([123])\)$/.exec(f["DAL"] ?? "");
      if (dm && Number(dm[2]) !== d.tier) warn(`${where}: DAL katmanı klasörle uyuşmuyor (${f["DAL"]})`);
      const { secs } = sections(a.text, /^#{2,4}\s+(.+?)\s*$/m);
      const levels = (f["SEVİYELER"] ?? "1")
        .split("/")
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x) && x > 0);
      const maxLevel = levels.length ? Math.max(...levels) : 1;
      const levelEffects: { level: number; html: string }[] = [];
      const out: UcSection[] = [];
      const synergies: string[] = [];
      let flavor = "";
      for (const [key, txt] of secs) {
        if (key === "AÇIKLAMA") {
          flavor = txt;
          continue;
        }
        if (key.startsWith("SEVİYE ETK")) {
          const marks = [...txt.matchAll(/^\*\*SEVİYE\s*(\d+)\*\*\s*:?[ \t]*/gm)];
          marks.forEach((m, i) => {
            const end = i + 1 < marks.length ? marks[i + 1].index! : txt.length;
            levelEffects.push({ level: Number(m[1]), html: md(txt.slice(m.index! + m[0].length, end).trim()) });
          });
          if (!marks.length) warn(`${where}: SEVİYE ETKİLERİ içinde **SEVİYE n** yok`);
          continue;
        }
        if (key === "SİNERJİ")
          for (const sm of txt.matchAll(/\[\[([^\]|]+)/g)) {
            const k = nameToKey.get(linkKey(sm[1]));
            if (k && !synergies.includes(k)) synergies.push(k);
            else if (!k) warn(`${where}: sinerji yeteneği bulunamadı: ${sm[1]}`);
          }
        if (!txt.trim()) continue;
        out.push({ key, label: SECTION_LABELS[key] ?? titleCase(key), html: md(txt) });
      }
      if (!levelEffects.length && !out.some((s) => s.key === "ETKİ")) warn(`${where}: ne seviye etkisi ne ETKİ bölümü var`);
      if (levelEffects.length && levelEffects.length !== maxLevel) warn(`${where}: SEVİYELER ${maxLevel} ama ${levelEffects.length} seviye etkisi yazılı`);
      const requirements = parseRequirements(f["GEREKSİNİM"] ?? "", where);
      const flavorHtml = md(flavor);
      const ab: UcAbility = {
        key: a.key,
        name: a.name,
        classKey: c.key,
        dalKey: d.key,
        tier: d.tier,
        type: f["TİP"] ?? "",
        requirementText: f["GEREKSİNİM"] ?? "",
        requirements,
        maxLevel,
        signature: maxLevel === 1,
        levelEffects,
        sections: out,
        synergies,
        flavorHtml,
        searchText: "",
      };
      ab.searchText = plain([ab.name, c.name, d.name, ab.type, ab.requirementText, ...levelEffects.map((l) => l.html), ...out.map((s) => s.html), flavorHtml].join(" "));
      if (abilities[ab.key]) fail(`Aynı isimde iki yetenek: ${ab.name}`);
      abilities[ab.key] = ab;
      const maxReq = Math.max(0, ...requirements.map((r) => (r.kind === "stat" ? r.min : 0)));
      order.push({ key: ab.key, sort: [ab.signature ? 1 : 0, maxReq, ab.name] });
    }
    order.sort((x, y) => x.sort[0] - y.sort[0] || x.sort[1] - y.sort[1] || x.sort[2].localeCompare(y.sort[2]));
    if (order.length !== 5) warn(`${c.name}/${d.name}: ${order.length} yetenek var (kural: 5)`);
    const bonus = fieldsOf(d.text)["BAŞLANGIÇ BONUSU"] ?? null;
    const introHtml = md(stripFields(d.text));
    const dal: UcDal = {
      key: d.key,
      name: d.name,
      classKey: c.key,
      tier: d.tier,
      stat: d.stat ?? "yalman",
      identity: d.identity,
      introHtml,
      startBonusText: bonus ? bonus.replace(/\s+/g, " ").trim() : null,
      abilities: order.map((o) => o.key),
      searchText: plain([d.name, c.name, d.identity, introHtml, bonus ?? ""].join(" ")),
    };
    if (dals[dal.key]) fail(`Aynı isimde iki dal: ${dal.name}`);
    dals[dal.key] = dal;
    dalKeys.push(dal.key);
  }
  // Katman tablosu sayfada yapısal olarak çizilir; metinden çıkarılır. Diğer başlıklar olduğu gibi kalır.
  const ctxt = stripFields(c.text).replace(/^(#{2,4})\s+KATMANLAR\s*:?\s*$[\s\S]*?(?=^#{1,4}\s|(?![\s\S]))/m, "");
  const introHtml = md(ctxt);
  const csecs: UcSection[] = [];
  classes.push({ key: c.key, name: c.name, introHtml, sections: csecs, dals: dalKeys, searchText: plain([c.name, introHtml].join(" ")) });
}

const CATEGORY_ORDER = ["Köken", "Bağ", "Beden", "Zihin", "Beceri", "Mana", "Bağımlılık"];
const perks: UcPerk[] = rawPerks.map((p) => {
  const cat = (/^Kategori:\s*(.+)$/m.exec(p.text)?.[1] ?? "").trim();
  if (!cat) warn(`Perk ${p.name}: Kategori yok`);
  const exm = /^Birlikte Alınamaz:\s*(.*)$/m.exec(p.text);
  const exclusive: string[] = [];
  if (exm)
    for (const lm of exm[1].matchAll(/\[\[([^\]|]+)/g)) {
      const target = linkKey(lm[1]);
      const hit = rawPerks.find((x) => x.stem === target || x.name === target);
      if (hit) exclusive.push(hit.key);
      else fail(`Perk ${p.name}: birlikte alınamaz perk bulunamadı: ${target}`);
    }
  const body = p.text
    .replace(/^Kategori:.*$/m, "")
    .replace(/^Birlikte Alınamaz:.*$/m, "")
    .trim();
  const html = md(body);
  return { key: p.key, name: p.name, kind: p.kind, points: p.points, category: cat, exclusive, html, searchText: plain(p.name + " " + cat + " " + html) };
});
for (const p of perks)
  for (const k of p.exclusive) {
    const o = perks.find((x) => x.key === k);
    if (o && !o.exclusive.includes(p.key)) {
      warn(`Dışlama tek yönlü: ${p.name} → ${o.name} (iki yönlü kabul edildi)`);
      o.exclusive.push(p.key);
    }
  }
const seenPerk = new Set<string>();
for (const p of perks) {
  if (seenPerk.has(p.key)) fail(`Aynı isimde iki perk: ${p.name}`);
  seenPerk.add(p.key);
}
perks.sort((a, b) => (a.kind === b.kind ? a.points - b.points || a.name.localeCompare(b.name) : a.kind === "positive" ? -1 : 1));
const perkCategories = [...new Set(perks.map((p) => p.category).filter(Boolean))].sort(
  (a, b) => (CATEGORY_ORDER.indexOf(a) + 99) % 99 - (CATEGORY_ORDER.indexOf(b) + 99) % 99 || a.localeCompare(b),
);

const docs: UcDoc[] = [];
const used = new Set<string>();
for (const [fn, title] of DOC_ORDER) {
  const p = path.join(SYS, fn.normalize("NFC"));
  const alt = fs.readdirSync(SYS).find((x) => x.normalize("NFC") === fn.normalize("NFC"));
  if (!alt) {
    warn(`Kural dosyası yok: ${fn}`);
    continue;
  }
  used.add(alt);
  const html = md(read(path.join(SYS, alt)));
  void p;
  docs.push({ key: slug(title), title, html, searchText: plain(title + " " + html) });
}
for (const f of fs.readdirSync(SYS).filter((x) => x.endsWith(".md") && !used.has(x)).sort()) {
  const title = f.replace(/\.md$/, "").normalize("NFC");
  const html = md(read(path.join(SYS, f)));
  docs.push({ key: slug(title), title, html, searchText: plain(title + " " + html) });
}

// ---------------------------------------------------------------- yaz
const body = { docs, classes, dals, abilities, perks, perkCategories };
const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);
const content: UcContent = { generatedAt: new Date().toISOString(), hash, ...body };

const posN = perks.filter((p) => p.kind === "positive").length;
const negN = perks.filter((p) => p.kind === "negative").length;
console.log(`Kasa: ${VAULT}`);
console.log(`Sınıf ${classes.length} · Dal ${Object.keys(dals).length} · Yetenek ${Object.keys(abilities).length} · Perk ${posN}+/${negN}− · Kural ${docs.length}`);
for (const w of [...new Set(warnings)]) console.log("  uyarı: " + w);
for (const e of errors) console.log("  HATA: " + e);
if (errors.length) {
  console.error(`\n${errors.length} hata var; content/uc.json güncellenmedi.`);
  process.exit(1);
}
if (CHECK_ONLY) console.log("Kontrol tamam (--check: dosya yazılmadı).");
else {
  let prev = "";
  try {
    prev = JSON.parse(fs.readFileSync(OUT, "utf8")).hash;
  } catch {
    /* ilk çalıştırma */
  }
  if (prev === hash) console.log("İçerik değişmemiş; content/uc.json olduğu gibi bırakıldı.");
  else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(content, null, 1) + "\n");
    console.log(`Yazıldı: content/uc.json (${hash})`);
  }
}
