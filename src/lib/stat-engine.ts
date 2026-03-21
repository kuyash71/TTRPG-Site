/**
 * Stat Engine — Skill tree'den stat hesaplama motoru.
 *
 * Tüm BASE stat değerleri, açılmış skill node'larının
 * statBonusesPerLevel * currentLevel toplamından türetilir.
 *
 * DERIVED statlar, BASE statlar üzerinden formül ile hesaplanır.
 * RESOURCE statların maxValue'su formül ile hesaplanır.
 */

import type { PrismaClient } from "@/generated/prisma/client";

// ─── Types ──────────────────────────────────────────────

export interface StatDef {
  key: string;
  label: string;
  type: "BASE" | "DERIVED" | "RESOURCE";
  formula: FormulaNode | null;
  isPublic: boolean;
  maxVal: number | null;
}

export interface SkillUnlock {
  nodeId: string;
  currentLevel: number;
}

export interface SkillNode {
  id: string;
  statBonusesPerLevel: Record<string, number>;
}

/** Formül JSON yapısı */
export type FormulaNode =
  | { type: "stat"; key: string }
  | { type: "const"; value: number }
  | {
      type: "op";
      op:
        | "add"
        | "subtract"
        | "multiply"
        | "divide"
        | "floor"
        | "ceil"
        | "min"
        | "max";
      operands: FormulaNode[];
    };

export interface ComputedStat {
  key: string;
  label: string;
  type: "BASE" | "DERIVED" | "RESOURCE";
  baseValue: number;
  currentValue: number;
  maxValue: number | null;
  isPublic: boolean;
}

// ─── Core Functions ─────────────────────────────────────

/**
 * Skill unlock'larından BASE stat değerlerini hesaplar.
 * Her unlock: statBonusesPerLevel[statKey] * currentLevel
 */
export function calculateBaseStats(
  unlocks: SkillUnlock[],
  nodes: SkillNode[]
): Record<string, number> {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const stats: Record<string, number> = {};

  for (const unlock of unlocks) {
    const node = nodeMap.get(unlock.nodeId);
    if (!node) continue;

    const bonuses = node.statBonusesPerLevel;
    for (const [statKey, bonusPerLevel] of Object.entries(bonuses)) {
      stats[statKey] = (stats[statKey] || 0) + bonusPerLevel * unlock.currentLevel;
    }
  }

  return stats;
}

/**
 * Formül JSON'unu değerlendirir. Sonsuz döngü koruması var (depth=10).
 */
export function evaluateFormula(
  formula: FormulaNode,
  baseStats: Record<string, number>,
  depth = 0
): number {
  if (depth > 10) return 0;

  switch (formula.type) {
    case "stat":
      return baseStats[formula.key] ?? 0;
    case "const":
      return formula.value;
    case "op": {
      const vals = formula.operands.map((operand) =>
        evaluateFormula(operand, baseStats, depth + 1)
      );
      switch (formula.op) {
        case "add":
          return vals.reduce((a: number, b: number) => a + b, 0);
        case "subtract":
          return vals.length === 0 ? 0 : vals.reduce((a: number, b: number) => a - b);
        case "multiply":
          return vals.reduce((a: number, b: number) => a * b, 1);
        case "divide":
          return vals.length < 2 || vals[1] === 0 ? 0 : vals[0] / vals[1];
        case "floor":
          return Math.floor(vals[0] ?? 0);
        case "ceil":
          return Math.ceil(vals[0] ?? 0);
        case "min":
          return Math.min(...vals);
        case "max":
          return Math.max(...vals);
        default:
          return 0;
      }
    }
    default:
      return 0;
  }
}

/**
 * Tüm statları hesaplar: BASE (skill'lerden), DERIVED (formülden), RESOURCE (max formülden).
 */
export function calculateAllStats(
  statDefs: StatDef[],
  unlocks: SkillUnlock[],
  nodes: SkillNode[]
): ComputedStat[] {
  const baseStats = calculateBaseStats(unlocks, nodes);
  const results: ComputedStat[] = [];

  // Önce BASE statları hesapla
  for (const def of statDefs) {
    if (def.type === "BASE") {
      const val = baseStats[def.key] ?? 0;
      results.push({
        key: def.key,
        label: def.label,
        type: "BASE",
        baseValue: val,
        currentValue: val,
        maxValue: def.maxVal,
        isPublic: def.isPublic,
      });
    }
  }

  // DERIVED statları hesapla (BASE'lere bağlı)
  for (const def of statDefs) {
    if (def.type === "DERIVED" && def.formula) {
      const val = Math.floor(evaluateFormula(def.formula as FormulaNode, baseStats));
      results.push({
        key: def.key,
        label: def.label,
        type: "DERIVED",
        baseValue: val,
        currentValue: val,
        maxValue: null,
        isPublic: def.isPublic,
      });
    }
  }

  // RESOURCE statları hesapla (maxValue formülden, currentValue = maxValue)
  for (const def of statDefs) {
    if (def.type === "RESOURCE") {
      let maxValue = def.maxVal ?? 0;
      if (def.formula) {
        maxValue = Math.floor(evaluateFormula(def.formula as FormulaNode, baseStats));
      }
      results.push({
        key: def.key,
        label: def.label,
        type: "RESOURCE",
        baseValue: maxValue,
        currentValue: maxValue,
        maxValue,
        isPublic: def.isPublic,
      });
    }
  }

  return results;
}

/**
 * Karakter statlarını skill unlock'larına göre yeniden hesaplar ve DB'yi günceller.
 * Tek transaction içinde çalışır.
 */
export async function recalculateCharacterStats(
  prisma: PrismaClient,
  characterId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Karakteri ve ilişkili veriyi al
    const character = await tx.character.findUniqueOrThrow({
      where: { id: characterId },
      include: {
        skillUnlocks: {
          include: { node: true },
        },
      },
    });

    if (!character.gamesetId) return;

    // Gameset stat tanımlarını al
    const statDefs = await tx.statDefinition.findMany({
      where: { gamesetId: character.gamesetId },
    });

    // Hesaplama
    const unlocks: SkillUnlock[] = character.skillUnlocks.map((u) => ({
      nodeId: u.nodeId,
      currentLevel: u.currentLevel,
    }));

    const nodes: SkillNode[] = character.skillUnlocks.map((u) => ({
      id: u.node.id,
      statBonusesPerLevel: u.node.statBonusesPerLevel as Record<string, number>,
    }));

    const computed = calculateAllStats(
      statDefs.map((d) => ({
        key: d.key,
        label: d.label,
        type: d.type,
        formula: d.formula as FormulaNode | null,
        isPublic: d.isPublic,
        maxVal: d.maxVal,
      })),
      unlocks,
      nodes
    );

    // Mevcut statları al (currentValue'yu korumak için)
    const existingStats = await tx.characterStat.findMany({
      where: { characterId },
    });
    const existingMap = new Map(existingStats.map((s) => [s.name, s]));

    // Her stat için upsert
    for (const stat of computed) {
      const existing = existingMap.get(stat.key);

      // RESOURCE tipi için: currentValue'yu koru, sadece baseValue ve maxValue güncelle
      // Diğer tipler için: currentValue = baseValue
      const currentValue =
        stat.type === "RESOURCE" && existing
          ? Math.min(existing.currentValue, stat.maxValue ?? existing.currentValue)
          : stat.currentValue;

      await tx.characterStat.upsert({
        where: {
          characterId_name: { characterId, name: stat.key },
        },
        create: {
          characterId,
          name: stat.key,
          baseValue: stat.baseValue,
          currentValue,
          maxValue: stat.maxValue,
          isPublic: stat.isPublic,
        },
        update: {
          baseValue: stat.baseValue,
          currentValue,
          maxValue: stat.maxValue,
        },
      });
    }
  });
}
