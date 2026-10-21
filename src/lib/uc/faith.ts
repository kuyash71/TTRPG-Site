import type { UcFaith } from "./content-types";

/** Seçilen inanç: "trifarium/excidis" ya da "tvolktur". */
export interface UcFaithPick {
  faith: UcFaith;
  option: UcFaith["options"][number] | null;
  label: string;
  startCorruption: number;
}

export function ucFaithKey(faithKey: string, optionKey?: string | null) {
  return optionKey ? `${faithKey}/${optionKey}` : faithKey;
}

/** Anahtarı ve (gerekiyorsa) ayrıntıyı doğrular; geçersizse null. */
export function ucResolveFaith(faiths: UcFaith[] | undefined, key: string | null | undefined, detail?: string | null): UcFaithPick | null {
  if (!faiths?.length || !key) return null;
  const [fk, ok] = key.split("/");
  const faith = faiths.find((f) => f.key === fk);
  if (!faith) return null;
  const option = ok ? (faith.options.find((o) => o.key === ok) ?? null) : null;
  if (faith.options.length && !option) return null;
  if (!faith.options.length && ok) return null;
  const d = (detail ?? "").trim();
  if (faith.detailHint && d.length < 2) return null;
  const base = option ? `${faith.short} · ${option.name}` : faith.short;
  return { faith, option, label: (faith.detailHint ? `${base} · ${d}` : base).slice(0, 80), startCorruption: faith.startCorruption };
}
