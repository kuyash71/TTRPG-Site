import type { Locale } from "../../i18n/core";
import { UC_STAT_LABELS } from "./constants";
import { UC_TERM_TIPS } from "./tips";

// Umbra Caelis kural metnini okunaklı hale getirir: stat etkileri renkli rozet, stat adları ve
// sözlük terimleri tıklanınca açıklama balonu açan öğeler, zar ifadeleri ayrı biçimde.
// Türkçe ekler (Yalman'a, Yozlaşma'yı, Sinme'den) eşleşmeyi bozmaz.

const L = "A-Za-zÇĞİÖŞÜçğıöşüâîûÂÎÛ";
const STAT_NAMES = Object.values(UC_STAT_LABELS);
const STAT_KEY = new Map(Object.entries(UC_STAT_LABELS).map(([k, v]) => [v, k]));
const STAT_RX = STAT_NAMES.join("|");
const MOD_BEFORE = new RegExp(`([+\\-−]\\s?\\d+)(\\s+)(${STAT_RX})(?![${L}])`, "g");
const MOD_AFTER = new RegExp(`(?<![${L}])(${STAT_RX})(\\s+)([+\\-−]\\s?\\d+)(?![\\d%])`, "g");
const STAT_ONLY = new RegExp(`(?<![${L}])(${STAT_RX})(?![${L}])`, "g");
const DICE = /(?<![A-Za-z0-9])(\d*d(?:4|6|8|10|12|20))(?![A-Za-z0-9])/g;
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Terimden sonra Türkçe ek gelebilir (yoz zarlara, Yozlaşma'yı); ek de vurgunun içinde kalır.
// Terim listesi dile göre ayrı kurulur ve önbelleğe alınır (İngilizce metinde ek kuralı zararsızdır).
type TermRx = { rx: RegExp; key: Map<string, string> };
const termCache = new Map<Locale, TermRx>();
function termsFor(loc: Locale): TermRx {
  const hit = termCache.get(loc);
  if (hit) return hit;
  const list = Object.entries(UC_TERM_TIPS[loc] ?? UC_TERM_TIPS.tr)
    .flatMap(([key, t]) => t.match.map((m) => [m, key] as const))
    .filter(([m]) => !!m)
    .sort((a, b) => b[0].length - a[0].length);
  const e: TermRx = {
    key: new Map(list.map(([m, k]) => [m, k])),
    rx: !list.length ? /(?!)/g : new RegExp(`(?<![${L}])(${list.map(([m]) => reEsc(m)).join("|")})((?:'[${L}]+|[${L}]{0,6})?)(?![${L}])`, "g"),
  };
  termCache.set(loc, e);
  return e;
}
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export function ucEnrich(html: string, loc: Locale = "tr") {
  const T = termsFor(loc);
  return html
    .split(/(<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>)/)
    .map((seg, i, all) => {
      if (seg.startsWith("<")) return seg;
      // bağlantı ve kod içindeki metne dokunma
      const prev = all.slice(0, i).reverse().find((s) => /^<\/?(a|code|pre)\b/i.test(s));
      if (prev && !prev.startsWith("</")) return seg;
      const marks: string[] = [];
      const keep = (s: string) => `\u0000${marks.push(s) - 1}\u0000`;
      let t = seg
        .replace(MOD_BEFORE, (_m, n: string, sp: string, st: string) => keep(`<span class="stat-mod ${/^[+]/.test(n) ? "pos" : "neg"}">${n.replace("-", "−")}${sp}${st}</span>`))
        .replace(MOD_AFTER, (_m, st: string, sp: string, n: string) => keep(`<span class="stat-mod ${/^[+]/.test(n) ? "pos" : "neg"}">${st}${sp}${n.replace("-", "−")}</span>`));
      t = t
        .replace(STAT_ONLY, (s) => keep(`<span class="stat-name" data-tip-src="uc" data-tip-kind="stats" data-tip-key="${STAT_KEY.get(s)}" data-tip-title="${attr(s)}">${s}</span>`))
        .replace(T.rx, (_m, term: string, suffix: string) =>
          keep(`<span class="term" data-tip-src="uc" data-tip-kind="terms" data-tip-key="${T.key.get(term)}" data-tip-title="${attr(term)}">${term}${suffix}</span>`),
        )
        .replace(DICE, (s) => keep(`<span class="dice">${s}</span>`));
      return t.replace(/\u0000(\d+)\u0000/g, (_m, k: string) => marks[Number(k)]);
    })
    .join("");
}
