// Umbra Caelis TTRPG sabitleri. SHZ ile aynı çekirdek; statlar ve sınıf sistemi UC'ye özgü.

/** Umbra Caelis kurallarının yayınlandığı adres (umbracaelis.com/umbracaelis/kurallar). */
export const UC_BASE = "/umbracaelis/kurallar";

export const UC_STAT_KEYS = ["yalman", "kacinc", "goru", "giz", "marifet", "hikmet", "efsun", "sebahat", "hakimiyet", "cazibe"] as const;
export type UcStatKey = (typeof UC_STAT_KEYS)[number];

export const UC_STAT_LABELS: Record<UcStatKey, string> = {
  yalman: "Yalman",
  kacinc: "Kaçınç",
  goru: "Görü",
  giz: "Giz",
  marifet: "Marifet",
  hikmet: "Hikmet",
  efsun: "Efsun",
  sebahat: "Sebahat",
  hakimiyet: "Hakimiyet",
  cazibe: "Cazibe",
};

const BY_LABEL = new Map(Object.entries(UC_STAT_LABELS).map(([k, v]) => [v.toLocaleLowerCase("tr-TR"), k as UcStatKey]));
export function ucStatFromLabel(s: string): UcStatKey | null {
  return BY_LABEL.get(s.trim().toLocaleLowerCase("tr-TR")) ?? null;
}

/** Referans eşik tablosu (Core). */
export const UC_THRESHOLDS = [
  { label: "Çok Kolay", value: 7 },
  { label: "Kolay", value: 9 },
  { label: "Orta", value: 13 },
  { label: "Zor", value: 15 },
  { label: "Çok Zor", value: 19 },
  { label: "Uber", value: 22 },
] as const;

export const UC_TIER_OPEN: Record<1 | 2 | 3, number> = { 1: 0, 2: 5, 3: 10 };
