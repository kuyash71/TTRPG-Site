// Yeni oyuncular için Almanca terimlerin Türkçe anlamı, okunuşu ve "ne işe yarar" özeti.
// Veri content/tips.json dosyasındadır; kural içeriğinden (shz.json) bağımsız olarak elle düzenlenir.
import raw from "../../../content/tips.json";

export interface Tip {
  /** Adın Türkçe anlamı */
  meaning?: string;
  /** Yaklaşık okunuşu */
  say?: string;
  /** Sade Türkçe ile ne işe yaradığı */
  summary?: string;
}
export type TipKind = "abilities" | "augments" | "trees" | "perks" | "stats" | "terms";

interface TermTip extends Tip {
  match: string[];
}

const data = raw as unknown as {
  abilities: Record<string, Tip>;
  augments: Record<string, Tip>;
  trees: Record<string, Tip>;
  perks: Record<string, Tip>;
  stats: Record<string, Tip>;
  terms: Record<string, TermTip>;
  branches: Record<string, string>;
};

export function tipFor(kind: TipKind, key: string): Tip | null {
  return (data[kind] as Record<string, Tip>)[key] ?? null;
}
export function branchMeaning(name: string | null | undefined) {
  return name ? (data.branches[name] ?? null) : null;
}
export const TERM_TIPS = data.terms;
export const STAT_TIPS = data.stats;

/** Aramada kullanılmak üzere ipucunun küçük harfli düz metni. */
export function tipText(kind: TipKind, key: string) {
  const t = tipFor(kind, key);
  return t ? [t.meaning, t.summary].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR") : "";
}
