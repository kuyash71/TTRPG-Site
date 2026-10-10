// Umbra Caelis için yabancı adların Türkçe anlamı, okunuşu ve "ne işe yarar" özeti.
// Veri content/uc-tips.json dosyasındadır; kural içeriğinden (uc.json) bağımsız olarak elle düzenlenir.
import raw from "../../../content/uc-tips.json";

export interface UcTip {
  meaning?: string;
  say?: string;
  summary?: string;
}
export type UcTipKind = "classes" | "dals" | "abilities" | "perks" | "stats" | "terms";

interface TermTip extends UcTip {
  match: string[];
}

const data = raw as unknown as Record<Exclude<UcTipKind, "terms">, Record<string, UcTip>> & { terms: Record<string, TermTip> };

export function ucTipFor(kind: string, key: string): UcTip | null {
  return (data as unknown as Record<string, Record<string, UcTip> | undefined>)[kind]?.[key] ?? null;
}
export const UC_TERM_TIPS = data.terms;

export function ucTipText(kind: UcTipKind, key: string) {
  const t = ucTipFor(kind, key);
  return t ? [t.meaning, t.summary].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR") : "";
}
