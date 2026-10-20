import type { Character, Stats } from "../../db/schema";
import { ucNormalizeStats, ucPoints, type UcCharLike, type UcRules, type UcStats } from "./rules";

/** Veritabanı satırını Umbra Caelis kural motorunun beklediği biçime çevirir. */
export function asUcChar(c: Pick<Character, "level" | "stats" | "trees" | "abilities" | "perks" | "body" | "corruption" | "inspiration" | "uc">): UcCharLike {
  return {
    level: c.level,
    stats: ucNormalizeStats(c.stats as unknown as Record<string, number>),
    trees: c.trees,
    abilities: c.abilities,
    perks: c.perks,
    body: c.body,
    corruption: c.corruption,
    inspiration: c.inspiration,
    uc: c.uc ?? {},
  };
}

/** UC statlarını ortak `stats` sütununa yazmak için (sütun SHZ tipindedir; içerik sisteme göre değişir). */
export const ucStatsColumn = (s: UcStats) => s as unknown as Stats;

/** Harcanmamış yetenek puanı (katman kilidi + Zirve). `abilityPoints` sütununda panel/rozetler için tutulur. */
export function ucUnspent(c: Pick<UcCharLike, "level" | "abilities">, data: Pick<UcRules, "abilities">) {
  return ucPoints(c, data).unspent;
}
