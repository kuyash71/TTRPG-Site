// K3 dal mekaniklerinin karakter kâğıdındaki sayaçları. Kurallar kasadaki a.DAL dosyalarındadır;
// burada yalnızca sayacın adı ve (kurala göre hesaplanan) üst sınırı tutulur.
import type { UcStats } from "./rules";

export interface UcCounterDef {
  key: string;
  label: string;
  /** Üst sınır (yoksa sınırsız). */
  max?: (s: UcStats, ctx: { corruption: number; abilities: Record<string, number> }) => number;
  /** Üst sınırın nasıl hesaplandığı */
  maxText?: string;
  /** Sayacın kısa açıklaması */
  hint: string;
  /** Yalnızca bu yetenek açıksa göster */
  needs?: string;
  /** Evet/hayır işareti (sayı yerine) */
  flag?: boolean;
  /** Sayı yerine (ya da yanında) not alanı */
  notes?: string;
}

const half = (n: number) => Math.floor(n / 2);

export const UC_DAL_COUNTERS: Record<string, UcCounterDef[]> = {
  shinigami: [
    { key: "akis", label: "Akış", max: (s) => Math.max(2, s.efsun + half(s.sebahat)), maxText: "Efsun + Sebahat/2, en az 2", hint: "Her çatışma başında dolar. Erwachen tur başına 1, Apotheosis 2 harcar." },
    { key: "rezonans", label: "Rezonans", hint: "Jinzen ile kazanılır; 1 Rezonans = 2 Akış." },
  ],
  duelist: [
    { key: "aciklik", label: "Açıklık", max: () => 3, maxText: "en fazla 3", hint: "Düello Rakibinin saldırısını boşa çıkarınca +1. Çatışma sonunda silinir." },
    {
      key: "nam",
      label: "Nam",
      needs: "charisma-of-steel",
      max: (_s, c) => [0, 2, 3, 4][c.abilities["charisma-of-steel"] ?? 0] ?? 4,
      maxText: "Charisma of Steel seviyesine göre 2 / 3 / 4",
      hint: "Bire bir zaferlerden kazanılır; seanslar arasında korunur.",
    },
  ],
  slayer: [{ key: "av-defteri", label: "Av Defteri", hint: "Her tür için 1–3 Sayfa. Satır başına bir tür yaz: ör. Etten Duvar — 2.", notes: "Tür — Sayfa" }],
  stormer: [{ key: "atilim", label: "Atılım", max: () => 3, maxText: "en fazla 3", hint: "Hareket edip saldırınca +1 (tur başına 1). Durunca −1; Sinme hepsini siler." }],
  archpriest: [
    {
      key: "lutuf",
      label: "Lütuf",
      max: (s, c) => Math.max(0, half(s.sebahat) - Math.floor(c.corruption / 3)),
      maxText: "Sebahat/2 − Yozlaşma/3, en az 0",
      hint: "Her seans başında dolar. Dua zarında Nat20 = +1 Lütuf.",
    },
  ],
  occultist: [
    { key: "ip", label: "İp", max: (s) => half(s.hakimiyet), maxText: "Hakimiyet/2", hint: "Zihnine girdiğin kişiler. Kuklalar sayılmaz.", notes: "İp bağlı kişiler" },
  ],
  catastrophe: [
    { key: "kizil-yuk", label: "Kızıl Yük", max: (s) => Math.max(2, half(s.efsun)), maxText: "Efsun/2, en az 2", hint: "Başarılı yoz zarda +1. Çatışma sonunda kalan her 2 Yük = +1 Yozlaşma." },
  ],
  divine: [{ key: "gok-dinleme", label: "Göğü dinledi", flag: true, max: () => 1, maxText: "bu seans", hint: "Uzun dinlenmede başarılı Sebahat (Zor): bu seans Gök bir basamak açık sayılır." }],
};

export type UcSkyState = "acik" | "bulutlu" | "sustu";
export const UC_SKY_LABEL: Record<UcSkyState, string> = { acik: "Açık", bulutlu: "Bulutlu", sustu: "Sustu" };
/** Divine · Göğün Sesi: Yozlaşmaya göre gök (dinleme bir basamak açar). */
export function ucSkyState(corruption: number, listened: boolean): UcSkyState {
  const base = corruption <= 2 ? 0 : corruption <= 4 ? 1 : 2;
  return (["acik", "bulutlu", "sustu"] as const)[Math.max(0, base - (listened ? 1 : 0))];
}
