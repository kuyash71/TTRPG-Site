import type { Ability } from "./content-types";

/** Yetenek kolu etiketi: "Kök" ya da "A · Kolun adı". `t` verilirse "Kök" çevrilir. */
export function branchLabel(a: Pick<Ability, "branch" | "branchName">, t: (s: string) => string = (s) => s) {
  if (a.branch === "Kök") return t("Kök");
  return `${a.branch}${a.branchName ? ` · ${a.branchName}` : ""}`;
}
