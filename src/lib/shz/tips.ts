// Yeni oyuncular için Almanca terimlerin Türkçe (ya da İngilizce) anlamı, okunuşu ve "ne işe yarar" özeti.
// Veri content/tips.json (Türkçe) ve content/tips.en.json (İngilizce) dosyalarındadır; kural içeriğinden
// (shz.json) bağımsız olarak elle düzenlenir.
import rawTr from "../../../content/tips.json";
import rawEn from "../../../content/tips.en.json";
import type { Locale } from "../../i18n/core";

export interface Tip {
  /** Adın anlamı */
  meaning?: string;
  /** Yaklaşık okunuşu */
  say?: string;
  /** Sade dille ne işe yaradığı */
  summary?: string;
}
export type TipKind = "abilities" | "augments" | "trees" | "perks" | "stats" | "terms";

export interface TermTip extends Tip {
  match: string[];
}

interface TipData {
  abilities: Record<string, Tip>;
  augments: Record<string, Tip>;
  trees: Record<string, Tip>;
  perks: Record<string, Tip>;
  stats: Record<string, Tip>;
  terms: Record<string, TermTip>;
  branches: Record<string, string>;
}

const DATA: Record<Locale, TipData> = {
  tr: rawTr as unknown as TipData,
  en: rawEn as unknown as TipData,
};
const dataFor = (loc: Locale) => DATA[loc] ?? DATA.tr;

export function tipFor(kind: TipKind, key: string, loc: Locale = "tr"): Tip | null {
  return (dataFor(loc)[kind] as Record<string, Tip> | undefined)?.[key] ?? (dataFor("tr")[kind] as Record<string, Tip> | undefined)?.[key] ?? null;
}
export function branchMeaning(name: string | null | undefined, loc: Locale = "tr") {
  return name ? (dataFor(loc).branches[name] ?? null) : null;
}
/** Dile göre sözlük terimleri (Corruption, Cower…). */
export const termTips = (loc: Locale = "tr") => dataFor(loc).terms;
export const statTips = (loc: Locale = "tr") => dataFor(loc).stats;
export const TERM_TIPS: Record<Locale, Record<string, TermTip>> = { tr: DATA.tr.terms, en: DATA.en.terms };
export const STAT_TIPS: Record<Locale, Record<string, Tip>> = { tr: DATA.tr.stats, en: DATA.en.stats };

/** Aramada kullanılmak üzere ipucunun küçük harfli düz metni. */
export function tipText(kind: TipKind, key: string, loc: Locale = "tr") {
  const t = tipFor(kind, key, loc);
  return t ? [t.meaning, t.summary].filter(Boolean).join(" ").toLocaleLowerCase(loc === "en" ? "en-GB" : "tr-TR") : "";
}
