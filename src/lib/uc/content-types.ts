import type { UcStatKey } from "./constants";

// content/uc.json dosyasının şekli. `npm run sync:uc` ile Umbra Caelis kasasından
// (Ucaelis-TTRPG klasörü) üretilir; elle düzenlenmez.

export type UcRequirement =
  | { kind: "stat"; stat: UcStatKey; min: number }
  | { kind: "level"; min: number }
  | { kind: "decayMin"; min: number }
  | { kind: "decayMax"; max: number }
  | { kind: "text"; text: string };

export interface UcSection {
  key: string; // ETKİ, BEDEL, NOT, SİNERJİ, ÖN KOŞUL...
  label: string;
  html: string;
}

export interface UcAbility {
  key: string;
  name: string;
  classKey: string;
  dalKey: string;
  tier: 1 | 2 | 3;
  type: string; // Aktif / Pasif / Tepki
  requirementText: string;
  requirements: UcRequirement[];
  maxLevel: number;
  /** Dalın imzası: tek seviyeli, ağır gereksinimli yetenek */
  signature: boolean;
  levelEffects: { level: number; html: string }[];
  sections: UcSection[];
  synergies: string[];
  flavorHtml: string;
  searchText: string;
}

export interface UcDal {
  key: string;
  name: string;
  classKey: string;
  tier: 1 | 2 | 3;
  stat: UcStatKey;
  /** a.CLASS tablosundaki kısa kimlik */
  identity: string;
  introHtml: string;
  startBonusText: string | null;
  abilities: string[];
  searchText: string;
}

export interface UcClass {
  key: string;
  name: string;
  introHtml: string;
  /** Katman tablosu dışındaki bölümler (örnek yollar, inanç, notlar) */
  sections: UcSection[];
  dals: string[]; // K1, K1, K2, K2, K3, K3
  searchText: string;
}

export interface UcPerk {
  key: string;
  name: string;
  kind: "positive" | "negative";
  points: number;
  category: string;
  exclusive: string[];
  html: string;
  searchText: string;
}

export interface UcDoc {
  key: string;
  title: string;
  html: string;
  searchText: string;
}

export interface UcContent {
  generatedAt: string;
  hash: string;
  docs: UcDoc[];
  classes: UcClass[];
  dals: Record<string, UcDal>;
  abilities: Record<string, UcAbility>;
  perks: UcPerk[];
  perkCategories: string[];
}
