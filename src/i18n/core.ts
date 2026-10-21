// Arayüz dili: Türkçe (kaynak) ve İngilizce. Anahtarlar Türkçe metnin kendisidir (gettext gibi):
// t("Kaydet") → "Save". Değişkenler {ad} biçiminde yazılır: t("{n} yetenek", { n: 3 }).
import { EN } from "./en";

export type Locale = "tr" | "en";
export const LOCALES: Locale[] = ["tr", "en"];
export const LOCALE_COOKIE = "lang";
export const isLocale = (v: unknown): v is Locale => v === "tr" || v === "en";

export type TVars = Record<string, string | number | null | undefined>;
export type TFn = (s: string, vars?: TVars) => string;

function fill(s: string, vars?: TVars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars && vars[k] != null ? String(vars[k]) : m));
}

export function translate(loc: Locale, s: string, vars?: TVars): string {
  if (loc === "en") {
    const hit = EN[s];
    if (hit !== undefined) return fill(hit, vars);
  }
  return fill(s, vars);
}

export const makeT =
  (loc: Locale): TFn =>
  (s, vars) =>
    translate(loc, s, vars);

/** Tarih/sayı biçimi için BCP-47 etiketi. */
export const intlLocale = (loc: Locale) => (loc === "en" ? "en-GB" : "tr-TR");

/** Accept-Language başlığından ilk tercih: Türkçe değilse İngilizce. */
export function localeFromAcceptLanguage(h: string | null | undefined): Locale {
  const first = (h ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "tr";
  return first.startsWith("tr") ? "tr" : "en";
}

/** Çerez başlığından dil (yoksa Accept-Language). Sunucu, API ve soket tarafında kullanılır. */
export function localeFromHeaders(cookie: string | null | undefined, acceptLanguage?: string | null): Locale {
  const m = /(?:^|;\s*)lang=(tr|en)\b/.exec(cookie ?? "");
  return m ? (m[1] as Locale) : localeFromAcceptLanguage(acceptLanguage);
}

/** Türkçe şablonu doldurur (kayda yazılan metinler için): fmt("Seviye {n}", { n: 3 }). */
export const fmt = (s: string, vars?: TVars) => fill(s, vars);

let patterns: { rx: RegExp; names: string[]; en: string }[] | null = null;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Kayda Türkçe yazılmış metni (zar notu, karakter kaydı) göstermek için çevirir:
 * önce birebir eşleşme, sonra {değişken}li sözlük şablonlarıyla eşleşme. Bulunamazsa olduğu gibi döner.
 */
export function translateLoose(loc: Locale, s: string, depth = 0): string {
  if (loc === "tr" || !s) return s;
  const hit = EN[s];
  if (hit !== undefined) return hit;
  if (!patterns)
    patterns = Object.entries(EN)
      .filter(([k]) => /\{\w+\}/.test(k))
      .map(([k, en]) => {
        const names: string[] = [];
        const rx = new RegExp(
          "^" +
            k
              .split(/(\{\w+\})/)
              .map((part) => {
                const m = /^\{(\w+)\}$/.exec(part);
                if (m) {
                  names.push(m[1]);
                  return "([\\s\\S]+?)";
                }
                return esc(part);
              })
              .join("") +
            "$",
        );
        return { rx, names, en };
      })
      .sort((a, b) => b.rx.source.length - a.rx.source.length);
  for (const p of patterns) {
    const m = p.rx.exec(s);
    if (m)
      return fill(
        p.en,
        Object.fromEntries(
          // Değişken değerleri de (ör. birleştirilmiş liste öğeleri) sözlükte varsa çevrilir.
          p.names.map((n, i) => [n, depth < 2 ? m[i + 1].split(", ").map((x) => translateLoose(loc, x, depth + 1)).join(", ") : m[i + 1]]),
        ),
      );
  }
  return s;
}
