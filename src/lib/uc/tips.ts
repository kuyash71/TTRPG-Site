// Umbra Caelis için yabancı adların anlamı, okunuşu ve "ne işe yarar" özeti.
// Veri content/uc-tips.json (Türkçe) ve content/uc-tips.en.json (İngilizce) dosyalarındadır; kural
// içeriğinden (uc.json) bağımsız olarak elle düzenlenir.
import rawTr from "../../../content/uc-tips.json";
import rawEn from "../../../content/uc-tips.en.json";
import type { Locale } from "../../i18n/core";

export interface UcTip {
  meaning?: string;
  say?: string;
  summary?: string;
}
export type UcTipKind = "classes" | "dals" | "abilities" | "perks" | "stats" | "terms";

export interface UcTermTip extends UcTip {
  match: string[];
}

type UcTipData = Record<Exclude<UcTipKind, "terms">, Record<string, UcTip>> & { terms: Record<string, UcTermTip> };

const DATA: Record<Locale, UcTipData> = {
  tr: rawTr as unknown as UcTipData,
  en: rawEn as unknown as UcTipData,
};
const dataFor = (loc: Locale) => DATA[loc] ?? DATA.tr;
const pickKind = (d: UcTipData, kind: string) => (d as unknown as Record<string, Record<string, UcTip> | undefined>)[kind];

export function ucTipFor(kind: string, key: string, loc: Locale = "tr"): UcTip | null {
  return pickKind(dataFor(loc), kind)?.[key] ?? pickKind(DATA.tr, kind)?.[key] ?? null;
}
/** Dile göre sözlük terimleri. */
export const ucTermTips = (loc: Locale = "tr") => dataFor(loc).terms;
export const UC_TERM_TIPS: Record<Locale, Record<string, UcTermTip>> = { tr: DATA.tr.terms, en: DATA.en.terms };

export function ucTipText(kind: UcTipKind, key: string, loc: Locale = "tr") {
  const t = ucTipFor(kind, key, loc);
  return t ? [t.meaning, t.summary].filter(Boolean).join(" ").toLocaleLowerCase(loc === "en" ? "en-GB" : "tr-TR") : "";
}
