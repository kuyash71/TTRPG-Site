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
}

export const DEFAULT_GAMESET_CONFIG: GamesetConfig = {
  maxLevel: 20,
  startingSkillPoints: 5,
  skillPointsPerLevel: 2,
  manaLabel: "Mana",
  inventoryGridWidth: 10,
  inventoryGridHeight: 6,
  equipmentSlotsEnabled: true,
  maxSpellSlots: 4,
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
  };
}
