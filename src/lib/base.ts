import type { Locale } from "../i18n/core";
import { TERM_TIPS } from "./shz/tips";

/** Uygulamanın yayınlandığı alt yol (umbracaelis.com/schwarzesonne). */
export const BASE_PATH = "/schwarzesonne";

/** Ham <a href> ve fetch çağrıları için alt yolu ekler. next/link bunu kendisi yapar. */
export function withBase(p: string) {
  return BASE_PATH + (p.startsWith("/") ? p : "/" + p);
}

/** İçerik HTML'indeki "@/" ile başlayan bağlantıları gerçek adrese çevirir. */
export function resolveContentLinks(html: string) {
  return html.replace(/href="@\//g, `href="${BASE_PATH}/`);
}

/** Karakter portresinin adresi; sürüm 0 ise portre yoktur. */
export function portraitUrl(characterId: string, version: number | null | undefined) {
  return version ? withBase(`/api/characters/${characterId}/portrait?v=${version}`) : null;
}

const STAT_RX = "Korp|Krach|Klang|Sanita|Rede|Wissen|Sicht|Agil|Werk|Leis|Aim";
const MOD_BEFORE = new RegExp(`([+\\-−]\\s?\\d+)(\\s+)(${STAT_RX})\\b`, "gi");
const MOD_AFTER = new RegExp(`\\b(${STAT_RX})(\\s+)([+\\-−]\\s?\\d+)(?![\\d%])`, "gi");
const STAT_ONLY = new RegExp(`\\b(${STAT_RX})\\b`, "g");
const DICE = /\b(\d*d(?:4|6|8|10|12|20))\b/g;
// Sözlük terimleri (Corruption, Cower…): en uzun eşleşme önce. Dile göre ayrı kurulur ve önbelleğe alınır.
type TermRx = { rx: RegExp; key: Map<string, string> };
const termCache = new Map<Locale, TermRx>();
function termsFor(loc: Locale): TermRx {
  const hit = termCache.get(loc);
  if (hit) return hit;
  const list = Object.entries(TERM_TIPS[loc] ?? TERM_TIPS.tr)
    .flatMap(([key, t]) => t.match.map((m) => [m, key] as const))
    .filter(([m]) => !!m)
    .sort((a, b) => b[0].length - a[0].length);
  const e: TermRx = {
    key: new Map(list.map(([m, k]) => [m.toLowerCase(), k])),
    rx: !list.length ? /(?!)/g : new RegExp(`\\b(${list.map(([m]) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g"),
  };
  termCache.set(loc, e);
  return e;
}
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * İçerik metnini okunaklı hale getirir: stat etkileri renkli rozet, stat adları vurgulu,
 * zar ifadeleri (d20, 2d6) ayrı biçimde. Yalnızca etiket dışındaki metne dokunur.
 */
export function enrichContent(html: string, loc: Locale = "tr") {
  const T = termsFor(loc);
  return resolveContentLinks(html)
    .split(/(<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>)/)
    .map((seg) => {
      if (seg.startsWith("<")) return seg;
      const marks: string[] = [];
      const keep = (s: string) => `\u0000${marks.push(s) - 1}\u0000`;
      let t = seg
        .replace(MOD_BEFORE, (_m, n: string, sp: string, st: string) => keep(`<span class="stat-mod ${/^[+]/.test(n) ? "pos" : "neg"}">${n.replace("-", "−")}${sp}${st}</span>`))
        .replace(MOD_AFTER, (_m, st: string, sp: string, n: string) => keep(`<span class="stat-mod ${/^[+]/.test(n) ? "pos" : "neg"}">${st}${sp}${n.replace("-", "−")}</span>`));
      t = t
        .replace(STAT_ONLY, (s) => keep(`<span class="stat-name" data-tip-kind="stats" data-tip-key="${s.toLowerCase()}" data-tip-title="${attr(s)}">${s}</span>`))
        .replace(T.rx, (s) => keep(`<span class="term" data-tip-kind="terms" data-tip-key="${T.key.get(s.toLowerCase())}" data-tip-title="${attr(s)}">${s}</span>`))
        .replace(DICE, (s) => keep(`<span class="dice">${s}</span>`));
      return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => marks[Number(i)]);
    })
    .join("");
}
