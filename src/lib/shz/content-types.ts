import type { BodyPartKey, StatKey } from "./constants";

// content/shz.json dosyasının şekli. Dosya `npm run sync` ile Obsidian
// kasasından üretilir; elle düzenlenmez.

export type Requirement =
  | { kind: "stat"; stat: StatKey; min: number }
  | { kind: "level"; min: number }
  | { kind: "corruption"; min: number }
  | { kind: "augments"; min: number }
  | { kind: "text"; text: string };

export type BranchCode = "Kök" | "A" | "A′" | "B" | "B′" | "?";

export interface AbilitySection {
  key: string; // ETKİ, BEDEL, NOT, SİNERJİ, HESAP...
  label: string;
  html: string;
}

export interface Ability {
  key: string;
  name: string;
  tree: string; // tree key
  type: string; // Aktif / Pasif / Tepki
  requirementText: string;
  requirements: Requirement[];
  maxLevel: number;
  prerequisite: string | null; // ability key
  branch: BranchCode;
  branchName: string;
  levelEffects: { level: number; html: string }[];
  sections: AbilitySection[];
  synergies: string[]; // ability keys
  flavorHtml: string;
  searchText: string;
}

export type TreeStartBonus =
  | { kind: "stat"; stat: StatKey; amount: number }
  | { kind: "corruption"; amount: number }
  | { kind: "augment"; tier: "T1" | "T2" | "T3" }
  | { kind: "none" };

export interface Tree {
  key: string;
  name: string;
  stat: StatKey;
  introHtml: string;
  startBonus: TreeStartBonus;
  startBonusText: string;
  abilities: string[];
  /** Başlangıç ağacı olamaz; yalnızca GM izniyle 2. ağaç olarak açılır (Mors). */
  restricted?: boolean;
}

export interface Perk {
  key: string;
  name: string;
  kind: "positive" | "negative";
  points: number;
  exclusive: string[];
  /** Metinden okunan sabit stat etkileri (ör. "+2 Rede"). Koşullu etkiler burada yoktur. */
  mods: { stat: StatKey; value: number }[];
  html: string;
  searchText: string;
}

export interface Augment {
  key: string;
  name: string;
  tier: "T1" | "T2" | "T3" | null;
  slots: BodyPartKey[];
  mods: { stat: StatKey; value: number }[];
  usageHtml: string;
  flavorHtml: string;
  extra: { label: string; html: string }[];
  searchText: string;
}

export interface RuleDoc {
  key: string;
  title: string;
  html: string;
  searchText: string;
}

export interface CampaignInfo {
  key: string;
  name: string;
  storyHtml: string;
  length: string;
  difficulty: string;
  emblem: string | null;
}

export interface Content {
  generatedAt: string;
  hash: string;
  docs: RuleDoc[];
  trees: Tree[];
  abilities: Record<string, Ability>;
  perks: Perk[];
  augments: Augment[];
  campaigns: CampaignInfo[];
}
