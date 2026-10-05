/**
 * Obsidian kasasındaki Schwarzesonne sistem dosyalarını okuyup
 * content/shz.json dosyasını üretir (gameset aktarıcı).
 *
 * Kullanım:   npm run sync
 *             npm run sync -- --vault "C:/Yol/Codex/TTRPG"
 *             npm run sync -- --check     (dosya yazmadan doğrular)
 *
 * Varsayılan kasa yolu: bu deponun iki üst klasöründeki TTRPG klasörü
 * (Codex/_Web/TTRPG-Site → Codex/TTRPG).
 *
 * Kampanya klasörlerinden yalnızca Campaign.md (hikâye, uzunluk, zorluk)
 * okunur; seans notları ve GM notları siteye AKTARILMAZ.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bodyPartFromVault,
  statFromLabel,
  type BodyPartKey,
  type StatKey,
} from "../src/lib/shz/constants";
import type {
  Ability,
  Augment,
  BranchCode,
  CampaignInfo,
  Content,
  Perk,
  Requirement,
  RuleDoc,
  Tree,
  TreeStartBonus,
} from "../src/lib/shz/content-types";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const CHECK_ONLY = process.argv.includes("--check");
const VAULT = path.resolve(
  arg("--vault") || process.env.VAULT_DIR || path.resolve(repo, "..", "..", "TTRPG"),
);
const SYS = path.join(VAULT, "System");
const CAMPAIGNS = path.join(VAULT, "Campaigns");
const OUT = path.join(repo, "content", "shz.json");

const TREE_ORDER = ["Ubermann", "Stahlkrieg", "Spionage", "Diplomat", "Wunderwaffe", "Schwarzesonne", "Metallkorp"];
const DOC_ORDER: [string, string][] = [
  ["Core.md", "Temel Kurallar"],
  ["Character.md", "Karakter"],
  ["Stats.md", "Statlar"],
  ["Body.md", "Beden ve Yaralar"],
  ["Corruption.md", "Corruption"],
];

const warnings: string[] = [];
const errors: string[] = [];
const warn = (m: string) => warnings.push(m);
const fail = (m: string) => errors.push(m);

// ---------------------------------------------------------------- yardımcılar
function read(p: string) {
  return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
}
function norm(s: string) {
  return s.replace(/İ/g, "i").toLowerCase().replace(/\u0307/g, "");
}
export function slug(s: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", ä: "a", ß: "ss", é: "e" };
  return norm(s)
    .replace(/[çğıöşüäßé]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function plain(h: string) {
  return norm(
    h
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
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
const stem = (p: string) => path.basename(p).replace(/\.md$/i, "");

// [[bağlantı]] hedefleri: isim -> { href, label }
const LINKS = new Map<string, { href: string; label: string }>();

function inline(src: string): string {
  let s = esc(src);
  s = s.replace(/!\[\[[^\]]+\]\]/g, "");
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const [target, alias] = inner.split("|").map((x) => x.trim());
    const l = LINKS.get(target);
    const label = alias || l?.label || target;
    if (!l) {
      warn(`Çözülemeyen bağlantı: [[${target}]]`);
      return label;
    }
    return `<a href="${l.href}">${label}</a>`;
  });
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "<em>$1</em>");
  s = s.replace(/-&gt;/g, "→").replace(/&gt;=/g, "≥").replace(/&lt;=/g, "≤");
  return s;
}

const HEAD = /^(#{1,6})\s+(.*?)\s*$/;
const CORR = /^\*\*CORRUPTION\s+(\d+)\s*:?\s*\*\*\s*:?\s*(.*)$/;
const isTab = (l: string) => (l.startsWith("\t") || l.startsWith("    ")) && l.trim() !== "";

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
      const tag = m[1].length <= 2 ? "h3" : "h4";
      out.push(`<${tag}>${inline(m[2].replace(/:+$/, ""))}</${tag}>`);
      i++;
      continue;
    }
    if (/^\s*-{3,}\s*$/.test(ln)) {
      flush();
      i++;
      continue;
    }
    if (CORR.test(ln.trim())) {
      flush();
      const rows: string[] = [];
      while (i < lines.length) {
        if (!lines[i].trim()) {
          i++;
          continue;
        }
        const c = CORR.exec(lines[i].trim());
        if (!c) break;
        const n = Number(c[1]);
        rows.push(`<li data-level="${n}"><span class="lvl">${n}</span><span>${inline(c[2])}</span></li>`);
        i++;
      }
      out.push('<ol class="corr">' + rows.join("") + "</ol>");
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
        const rows = block
          .map((b) => {
            const depth = b.length - b.replace(/^\t+/, "").length;
            return `<div style="padding-left:${Math.max(0, depth - 1) * 1.25}em">${inline(b.trim())}</div>`;
          })
          .join("");
        out.push(`<div class="formula">${rows}</div>`);
      }
      continue;
    }
    if (/^\s*[-*] /.test(ln)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""));
      out.push("<ul>" + items.map((x) => `<li>${inline(x)}</li>`).join("") + "</ul>");
      continue;
    }
    para.push(ln);
    i++;
  }
  flush();
  return out.join("\n");
}

function sections(text: string, re: RegExp): Map<string, string> {
  const parts = text.split(re);
  const m = new Map<string, string>();
  for (let k = 1; k < parts.length; k += 2) {
    m.set(parts[k].trim().replace(/:+$/, "").trim().toLocaleUpperCase("tr-TR"), (parts[k + 1] ?? "").trim());
  }
  return m;
}

// ---------------------------------------------------------------- toplama
if (!fs.existsSync(SYS)) {
  console.error(`Kasa bulunamadı: ${SYS}\n--vault ile TTRPG klasörünün yolunu ver.`);
  process.exit(1);
}

interface RawAbility {
  path: string;
  name: string;
  key: string;
  treeKey: string;
  text: string;
  fields: Record<string, string>;
}
interface RawTree {
  key: string;
  name: string;
  stat: StatKey;
  intro: string;
  abilities: RawAbility[];
}

const rawTrees: RawTree[] = [];
for (const e of fs.readdirSync(path.join(SYS, "Abilities"), { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const dir = path.join(SYS, "Abilities", e.name);
  const m = /^(.*?)\s*\(\s*(.*?)\s*\)\s*$/.exec(e.name);
  if (!m) {
    fail(`Ağaç klasör adı "İsim ( STAT )" biçiminde değil: ${e.name}`);
    continue;
  }
  const stat = statFromLabel(m[2]);
  if (!stat) {
    fail(`Bilinmeyen ağaç stat'ı: ${e.name}`);
    continue;
  }
  const name = m[1].trim();
  const files = walk(dir);
  let intro = "";
  const abilities: RawAbility[] = [];
  for (const f of files) {
    const t = read(f);
    if (path.basename(f).startsWith("a.CLASS")) {
      intro = t;
      continue;
    }
    const fields: Record<string, string> = {};
    for (const fm of t.matchAll(/^\*\*([A-ZÇĞİÖŞÜ]+)\*\*:\s*(.*)$/gm)) fields[fm[1]] = fm[2].trim();
    abilities.push({ path: f, name: stem(f), key: slug(stem(f)), treeKey: slug(name), text: t, fields });
  }
  rawTrees.push({ key: slug(name), name, stat, intro, abilities });
}
rawTrees.sort((a, b) => {
  const ia = TREE_ORDER.indexOf(a.name);
  const ib = TREE_ORDER.indexOf(b.name);
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
  for (const f of walk(path.join(SYS, "Perks", folder))) {
    const s = stem(f);
    const m = /^\(\s*([+-])\s*(\d+)\s*\)\s*(.+)$/.exec(s);
    if (!m) {
      fail(`Perk dosya adı "( ± N ) İsim" biçiminde değil: ${s}`);
      continue;
    }
    const name = m[3].trim();
    rawPerks.push({ stem: s, name, key: slug(name), points: Number(m[2]), kind, text: read(f) });
  }
}

interface RawAug {
  name: string;
  key: string;
  folder: string;
  secs: Map<string, string>;
}
const rawAugs: RawAug[] = walk(path.join(SYS, "Augmentations")).map((f) => ({
  name: stem(f),
  key: slug(stem(f)),
  folder: path.basename(path.dirname(f)),
  secs: sections(read(f), /^#{2,4}\s+(.+?)\s*$/m),
}));

// bağlantı tablosu
const BASE = "@";
for (const t of rawTrees)
  for (const a of t.abilities) LINKS.set(a.name, { href: `${BASE}/kurallar/yetenekler/${t.key}#${a.key}`, label: a.name });
for (const p of rawPerks) {
  const l = { href: `${BASE}/kurallar/perkler#${p.key}`, label: p.name };
  LINKS.set(p.stem, l);
  LINKS.set(p.name, l);
}
for (const a of rawAugs) LINKS.set(a.name, { href: `${BASE}/kurallar/augmentler#${a.key}`, label: a.name });

// ---------------------------------------------------------------- dönüştürme
function parseRequirements(txt: string, where: string): Requirement[] {
  const out: Requirement[] = [];
  if (!txt || /^yok$/i.test(txt.trim())) return out;
  for (const raw of txt.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    let m: RegExpExecArray | null;
    if ((m = /^Sv\.?\s*(\d+)$/i.exec(part))) out.push({ kind: "level", min: Number(m[1]) });
    else if ((m = /^Corruption\s+(?:en az\s+)?(\d+)$/i.exec(part))) out.push({ kind: "corruption", min: Number(m[1]) });
    else if ((m = /^en az\s+(\d+)\s+augment/i.exec(part))) out.push({ kind: "augments", min: Number(m[1]) });
    else if ((m = /^([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d+)$/.exec(part)) && statFromLabel(m[1]))
      out.push({ kind: "stat", stat: statFromLabel(m[1])!, min: Number(m[2]) });
    else {
      warn(`${where}: gereksinim tanınmadı, metin olarak kaldı: "${part}"`);
      out.push({ kind: "text", text: part });
    }
  }
  return out;
}

function parseBranch(kol: string): { code: BranchCode; name: string } {
  const k = kol.trim();
  if (!k) return { code: "?", name: "" };
  if (/^k[öo]k/i.test(k)) return { code: "Kök", name: "Kök" };
  const m = /^([AB])(\u2032|')?\s*(?:·|-|:)?\s*(.*)$/.exec(k);
  if (!m) return { code: "?", name: k };
  return { code: (m[1] + (m[2] ? "′" : "")) as BranchCode, name: m[3].trim() };
}

const SECTION_LABELS: Record<string, string> = {
  ETKİ: "Etki",
  BEDEL: "Bedel",
  NOT: "Not",
  SİNERJİ: "Sinerji",
  HESAP: "Hesap",
};

const abilities: Record<string, Ability> = {};
const trees: Tree[] = [];
const nameToKey = new Map<string, string>();
for (const t of rawTrees) for (const a of t.abilities) nameToKey.set(a.name, a.key);

for (const t of rawTrees) {
  // giriş metni ve ilk ağaç bonusu
  const bonusLine = t.intro.replace(/^\*\*BONUS STAT\*\*:.*$/m, "").trim();
  let startBonus: TreeStartBonus = { kind: "none" };
  let m: RegExpExecArray | null;
  if ((m = /\+\s*(\d+)\s+Corruption/i.exec(bonusLine))) startBonus = { kind: "corruption", amount: Number(m[1]) };
  else if ((m = /(T[123])\s+augment/i.exec(bonusLine))) startBonus = { kind: "augment", tier: m[1].toUpperCase() as "T1" };
  else if ((m = /\+\s*(\d+)\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)/.exec(bonusLine)) && statFromLabel(m[2]))
    startBonus = { kind: "stat", stat: statFromLabel(m[2])!, amount: Number(m[1]) };
  else warn(`${t.name}: ilk ağaç bonusu okunamadı ("${bonusLine}")`);

  const order: { key: string; sort: [number, number, number, string] }[] = [];
  for (const a of t.abilities) {
    const f = a.fields;
    const where = `${t.name}/${a.name}`;
    if (!Object.keys(f).length) {
      fail(`${where}: yeni yetenek formatında değil (EKSPERTİZ/TİP/... alanları yok)`);
      continue;
    }
    for (const req of ["TİP", "GEREKSİNİM", "SEVİYELER", "ÖNCÜL", "KOL"])
      if (!(req in f)) warn(`${where}: ${req} alanı eksik`);
    const secs = sections(a.text, /^####\s+(.+?)\s*$/m);
    const levels = (f["SEVİYELER"] ?? "1")
      .split("/")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x > 0);
    const maxLevel = levels.length ? Math.max(...levels) : 1;
    const oncRaw = (f["ÖNCÜL"] ?? "").trim();
    let prerequisite: string | null = null;
    if (oncRaw && !/^yok$/i.test(oncRaw)) {
      const lm = /\[\[([^\]|]+)/.exec(oncRaw);
      const target = (lm ? lm[1] : oncRaw).trim();
      prerequisite = nameToKey.get(target) ?? null;
      if (!prerequisite) fail(`${where}: öncül bulunamadı: ${oncRaw}`);
    }
    const branch = parseBranch(f["KOL"] ?? "");
    const levelEffects: { level: number; html: string }[] = [];
    const out: Ability["sections"] = [];
    const synergies: string[] = [];
    for (const [key, txt] of secs) {
      if (key === "AÇIKLAMA") continue;
      if (key.startsWith("SEVİYE ETK")) {
        // Seviye metni birden fazla satıra yayılabilir: bir sonraki "**SEVİYE n**" başlığına kadar her şey o seviyeye aittir.
        const marks = [...txt.matchAll(/^\*\*SEVİYE\s*(\d+)\*\*\s*:?[ \t]*/gm)];
        marks.forEach((m, i) => {
          const end = i + 1 < marks.length ? marks[i + 1].index! : txt.length;
          const body = txt
            .slice(m.index! + m[0].length, end)
            .trim()
            .replace(/\s*\n\s*/g, " ");
          levelEffects.push({ level: Number(m[1]), html: inline(body) });
        });
        continue;
      }
      if (key === "SİNERJİ")
        for (const sm of txt.matchAll(/\[\[([^\]|]+)/g)) {
          const k = nameToKey.get(sm[1].trim());
          if (k && !synergies.includes(k)) synergies.push(k);
        }
      out.push({ key, label: SECTION_LABELS[key] ?? key.charAt(0) + key.slice(1).toLocaleLowerCase("tr-TR"), html: md(txt) });
    }
    const flavorHtml = md(secs.get("AÇIKLAMA") ?? "");
    const ab: Ability = {
      key: a.key,
      name: a.name,
      tree: t.key,
      type: f["TİP"] ?? "",
      requirementText: f["GEREKSİNİM"] ?? "",
      requirements: parseRequirements(f["GEREKSİNİM"] ?? "", where),
      maxLevel,
      prerequisite,
      branch: branch.code,
      branchName: branch.name,
      levelEffects,
      sections: out,
      synergies,
      flavorHtml,
      searchText: "",
    };
    ab.searchText = plain(
      [ab.name, t.name, ab.type, ab.requirementText, ab.branchName, ...levelEffects.map((l) => l.html), ...out.map((s) => s.html), flavorHtml].join(" "),
    );
    if (abilities[ab.key]) fail(`Aynı isimde iki yetenek: ${ab.name}`);
    abilities[ab.key] = ab;
    const bOrder = { Kök: 0, A: 1, "A′": 2, B: 3, "B′": 4, "?": 5 }[branch.code];
    const maxReq = Math.max(0, ...ab.requirements.map((r) => ("min" in r ? r.min : 0)));
    order.push({ key: ab.key, sort: [bOrder, prerequisite ? 1 : 0, maxReq, ab.name] });
  }
  order.sort((x, y) => {
    for (let k = 0; k < 3; k++) if (x.sort[k] !== y.sort[k]) return (x.sort[k] as number) - (y.sort[k] as number);
    return x.sort[3].localeCompare(y.sort[3]);
  });
  trees.push({
    key: t.key,
    name: t.name,
    stat: t.stat,
    introHtml: md(bonusLine),
    startBonus,
    startBonusText: bonusLine.replace(/\s+/g, " ").trim(),
    abilities: order.map((o) => o.key),
  });
}

// öncül döngüsü / ağaç dışı öncül kontrolü
for (const a of Object.values(abilities)) {
  const seen = new Set<string>();
  let cur: string | null = a.key;
  while (cur) {
    if (seen.has(cur)) {
      fail(`Öncül döngüsü: ${a.name}`);
      break;
    }
    seen.add(cur);
    cur = abilities[cur]?.prerequisite ?? null;
  }
  if (a.prerequisite && abilities[a.prerequisite]?.tree !== a.tree)
    warn(`${a.name}: öncülü başka bir ağaçta (${abilities[a.prerequisite]?.name})`);
}

/**
 * Perk metnindeki sabit stat etkileri: "+2 Rede", "-2 Leis", "Oyuna +2 Klang ile başlarsın".
 * "zarlarına -2" gibi koşullu etkiler (sayı stat adından sonra gelir) ve "+2 Klang'a" gibi
 * ek açıklamalar alınmaz.
 */
function perkModsFrom(text: string): Perk["mods"] {
  const out: Perk["mods"] = [];
  for (const m of text.matchAll(/(^|[\s(.,;:])([+\-−])\s?(\d+)\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?=$|[\s.,;:)])/g)) {
    const st = statFromLabel(m[4]);
    if (!st) continue;
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 10);
    if (/^\s*zar/i.test(after)) continue;
    out.push({ stat: st, value: (m[2] === "+" ? 1 : -1) * Number(m[3]) });
  }
  return out;
}

const perks: Perk[] = rawPerks.map((p) => {
  const exm = /^\*\*MUTUALLY EXCLUSIVE WITH\*\*\s*(.*)$/m.exec(p.text);
  const exclusive: string[] = [];
  if (exm)
    for (const lm of exm[1].matchAll(/\[\[([^\]|]+)/g)) {
      const target = lm[1].trim();
      const hit = rawPerks.find((x) => x.stem === target || x.name === target);
      if (hit) exclusive.push(hit.key);
      else fail(`Perk ${p.name}: birlikte alınamaz perk bulunamadı: ${target}`);
    }
  const body = p.text.replace(/^\*\*MUTUALLY EXCLUSIVE WITH\*\*.*$/m, "").trim();
  const html = md(body);
  return { key: p.key, name: p.name, kind: p.kind, points: p.points, exclusive, mods: perkModsFrom(plain(html)), html, searchText: plain(p.name + " " + html) };
});
// dışlama simetrik olsun
for (const p of perks)
  for (const k of p.exclusive) {
    const o = perks.find((x) => x.key === k);
    if (o && !o.exclusive.includes(p.key)) {
      warn(`Dışlama tek yönlü: ${p.name} → ${o.name} (iki yönlü kabul edildi)`);
      o.exclusive.push(p.key);
    }
  }
perks.sort((a, b) => (a.kind === b.kind ? a.points - b.points || a.name.localeCompare(b.name) : a.kind === "positive" ? -1 : 1));

const augments: Augment[] = rawAugs.map((a) => {
  const tierRaw = (a.secs.get("TİER") ?? "").trim() || a.folder;
  const tier = /^T[123]$/.test(tierRaw) ? (tierRaw as Augment["tier"]) : null;
  if (!tier) warn(`Augment ${a.name}: tier yok`);
  const slots: BodyPartKey[] = [];
  for (const l of (a.secs.get("TAKILDIĞI YER") ?? "").split("\n")) {
    if (!l.trim()) continue;
    const bp = bodyPartFromVault(l);
    if (bp) slots.push(bp);
    else fail(`Augment ${a.name}: bilinmeyen uzuv "${l.trim()}"`);
  }
  const mods: Augment["mods"] = [];
  for (const l of (a.secs.get("STAT ETKİLERİ") ?? "").split("\n")) {
    if (!l.trim()) continue;
    const m = /^\s*([+-−])\s*(\d+)\s+(\S+)/.exec(l);
    const st = m ? statFromLabel(m[3]) : null;
    if (m && st) mods.push({ stat: st, value: (m[1] === "+" ? 1 : -1) * Number(m[2]) });
    else warn(`Augment ${a.name}: stat etkisi okunamadı "${l.trim()}"`);
  }
  const extra: Augment["extra"] = [];
  for (const [k, v] of a.secs)
    if (!["TİER", "TAKILDIĞI YER", "STAT ETKİLERİ", "ÖZELLİĞİ", "KULLANIM"].includes(k) && v.trim())
      extra.push({ label: k.charAt(0) + k.slice(1).toLocaleLowerCase("tr-TR"), html: md(v) });
  const usageHtml = md(a.secs.get("KULLANIM") ?? "");
  const flavorHtml = md(a.secs.get("ÖZELLİĞİ") ?? "");
  return { key: a.key, name: a.name, tier, slots, mods, usageHtml, flavorHtml, extra, searchText: plain(a.name + " " + usageHtml + " " + flavorHtml) };
});
augments.sort((a, b) => (a.tier ?? "T9").localeCompare(b.tier ?? "T9") || a.name.localeCompare(b.name));

const docs: RuleDoc[] = [];
const used = new Set<string>();
for (const [fn, title] of DOC_ORDER) {
  const p = path.join(SYS, fn);
  if (!fs.existsSync(p)) {
    warn(`Kural dosyası yok: ${fn}`);
    continue;
  }
  used.add(fn);
  const html = md(read(p));
  docs.push({ key: slug(title), title, html, searchText: plain(title + " " + html) });
}
for (const f of fs.readdirSync(SYS).filter((x) => x.endsWith(".md") && !used.has(x)).sort()) {
  const title = f.replace(/\.md$/, "");
  const html = md(read(path.join(SYS, f)));
  docs.push({ key: slug(title), title, html, searchText: plain(title + " " + html) });
}

const campaigns: CampaignInfo[] = [];
if (fs.existsSync(CAMPAIGNS))
  for (const e of fs.readdirSync(CAMPAIGNS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(CAMPAIGNS, e.name, "Campaign.md");
    if (!fs.existsSync(p)) continue;
    const raw = read(p);
    const secs = sections(raw, /^#{2,6}\s+(.+?)\s*$/m);
    const key = slug(e.name);
    // Amblem: Campaign.md içindeki ![[Campaign-XXX.png]] kodu → public/emblems/emb-XXX.png
    const code = /!\[\[Campaign-([A-Za-z0-9]+)\./.exec(raw)?.[1];
    const emblemName = code ? `emb-${code}.png` : `${key}.png`;
    const emblemFile = path.join(repo, "public", "emblems", emblemName);
    campaigns.push({
      key,
      name: e.name,
      storyHtml: md(secs.get("HİKAYE") ?? ""),
      length: (secs.get("UZUNLUK") ?? "").replace(/\s+/g, " ").trim(),
      difficulty: (secs.get("ZORLUK") ?? "").replace(/\s+/g, " ").trim(),
      emblem: fs.existsSync(emblemFile) ? `/emblems/${emblemName}` : null,
    });
  }
campaigns.sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------------------- yaz
const body = { docs, trees, abilities, perks, augments, campaigns };
const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12);
const content: Content = { generatedAt: new Date().toISOString(), hash, ...body };

const posN = perks.filter((p) => p.kind === "positive").length;
const negN = perks.filter((p) => p.kind === "negative").length;
console.log(`Kasa: ${VAULT}`);
console.log(
  `Ağaç ${trees.length} · Yetenek ${Object.keys(abilities).length} · Perk ${posN}+/${negN}− · Augment ${augments.length} · Kural ${docs.length} · Kampanya ${campaigns.length}`,
);
for (const w of warnings) console.log("  uyarı: " + w);
for (const e of errors) console.log("  HATA: " + e);
if (errors.length) {
  console.error(`\n${errors.length} hata var; content/shz.json güncellenmedi.`);
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log("Kontrol tamam (--check: dosya yazılmadı).");
} else {
  let prev = "";
  try {
    prev = JSON.parse(fs.readFileSync(OUT, "utf8")).hash;
  } catch {
    /* ilk çalıştırma */
  }
  if (prev === hash) console.log("İçerik değişmemiş; content/shz.json olduğu gibi bırakıldı.");
  else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(content, null, 1) + "\n");
    console.log(`Yazıldı: content/shz.json (${hash})`);
  }
}
