export type HpSystemType = "hit-die" | "realistic";

export interface RealisticHpState {
  label: string;
  color: string; // tailwind color class
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
  // HP System
  hpSystem: HpSystemType;
  realisticHpStates: RealisticHpState[];
  hitDieLevelsPerRoll: number; // kaç level'da bir hit-die atılır
}

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
  hpSystem: "hit-die",
  realisticHpStates: DEFAULT_REALISTIC_HP_STATES,
  hitDieLevelsPerRoll: 1,
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
  };
}
