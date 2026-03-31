export type HpSystemType = "hit-die" | "realistic";

export interface RealisticHpState {
  label: string;
  color: string; // tailwind color class
}

export interface CurrencyDef {
  code: string;       // unique key, e.g. "gold"
  name: string;       // display name, e.g. "Altın"
  symbol: string;     // short symbol, e.g. "🪙" or "G"
  rate: number;       // value relative to base (first) currency = 1
  sortOrder: number;
}

export interface GamesetConfig {
  maxLevel: number;
  startingSkillPoints: number;
  skillPointsPerLevel: number;
  manaLabel: string;
  // Sprint 6
  inventoryGridWidth: number;
  inventoryGridHeight: number;
  equipmentSlotsEnabled: boolean;
  // Sprint 7
  maxSpellSlots: number;
  // Inventory capacity
  inventoryCapacityStat: string | null;
  inventoryCapacityRowsPerPoint: number;
  // HP System
  hpSystem: HpSystemType;
  realisticHpStates: RealisticHpState[];
  hitDieLevelsPerRoll: number; // kaç level'da bir hit-die atılır
  // Economy
  currencies: CurrencyDef[];
}

export const DEFAULT_CURRENCIES: CurrencyDef[] = [
  { code: "gold", name: "Altın", symbol: "🪙", rate: 1, sortOrder: 0 },
  { code: "silver", name: "Gümüş", symbol: "🥈", rate: 0.1, sortOrder: 1 },
  { code: "copper", name: "Bakır", symbol: "🟤", rate: 0.01, sortOrder: 2 },
];

export const DEFAULT_REALISTIC_HP_STATES: RealisticHpState[] = [
  { label: "DIVINE", color: "text-yellow-400" },
  { label: "HEALTHY", color: "text-green-400" },
  { label: "MEDIOCRE", color: "text-orange-400" },
  { label: "CRITICAL", color: "text-red-400" },
];

export const DEFAULT_GAMESET_CONFIG: GamesetConfig = {
  maxLevel: 20,
  startingSkillPoints: 5,
  skillPointsPerLevel: 2,
  manaLabel: "Mana",
  inventoryGridWidth: 10,
  inventoryGridHeight: 6,
  equipmentSlotsEnabled: true,
  maxSpellSlots: 4,
  inventoryCapacityStat: null,
  inventoryCapacityRowsPerPoint: 0,
  hpSystem: "hit-die",
  realisticHpStates: DEFAULT_REALISTIC_HP_STATES,
  hitDieLevelsPerRoll: 1,
  currencies: DEFAULT_CURRENCIES,
};

export function parseGamesetConfig(raw: unknown): GamesetConfig {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    maxLevel:
      typeof obj.maxLevel === "number"
        ? obj.maxLevel
        : DEFAULT_GAMESET_CONFIG.maxLevel,
    startingSkillPoints:
      typeof obj.startingSkillPoints === "number"
        ? obj.startingSkillPoints
        : DEFAULT_GAMESET_CONFIG.startingSkillPoints,
    skillPointsPerLevel:
      typeof obj.skillPointsPerLevel === "number"
        ? obj.skillPointsPerLevel
        : DEFAULT_GAMESET_CONFIG.skillPointsPerLevel,
    manaLabel:
      typeof obj.manaLabel === "string"
        ? obj.manaLabel
        : DEFAULT_GAMESET_CONFIG.manaLabel,
    inventoryGridWidth:
      typeof obj.inventoryGridWidth === "number"
        ? obj.inventoryGridWidth
        : DEFAULT_GAMESET_CONFIG.inventoryGridWidth,
    inventoryGridHeight:
      typeof obj.inventoryGridHeight === "number"
        ? obj.inventoryGridHeight
        : DEFAULT_GAMESET_CONFIG.inventoryGridHeight,
    equipmentSlotsEnabled:
      typeof obj.equipmentSlotsEnabled === "boolean"
        ? obj.equipmentSlotsEnabled
        : DEFAULT_GAMESET_CONFIG.equipmentSlotsEnabled,
    maxSpellSlots:
      typeof obj.maxSpellSlots === "number"
        ? obj.maxSpellSlots
        : DEFAULT_GAMESET_CONFIG.maxSpellSlots,
    inventoryCapacityStat:
      typeof obj.inventoryCapacityStat === "string"
        ? obj.inventoryCapacityStat
        : DEFAULT_GAMESET_CONFIG.inventoryCapacityStat,
    inventoryCapacityRowsPerPoint:
      typeof obj.inventoryCapacityRowsPerPoint === "number"
        ? obj.inventoryCapacityRowsPerPoint
        : DEFAULT_GAMESET_CONFIG.inventoryCapacityRowsPerPoint,
    hpSystem:
      obj.hpSystem === "realistic" || obj.hpSystem === "hit-die"
        ? obj.hpSystem
        : DEFAULT_GAMESET_CONFIG.hpSystem,
    realisticHpStates:
      Array.isArray(obj.realisticHpStates)
        ? (obj.realisticHpStates as RealisticHpState[])
        : DEFAULT_GAMESET_CONFIG.realisticHpStates,
    hitDieLevelsPerRoll:
      typeof obj.hitDieLevelsPerRoll === "number"
        ? obj.hitDieLevelsPerRoll
        : DEFAULT_GAMESET_CONFIG.hitDieLevelsPerRoll,
    currencies:
      Array.isArray(obj.currencies) && obj.currencies.length > 0
        ? (obj.currencies as CurrencyDef[])
        : DEFAULT_GAMESET_CONFIG.currencies,
  };
}
