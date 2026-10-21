"use client";
import { useT } from "@/i18n/client";
import type { TVars } from "@/i18n/core";

/**
 * Hem sunucu hem istemci ağacında kullanılan (hook kullanamayan) sunum bileşenleri için çeviri öğesi:
 * <Tr s="Yan dal {b}" vars={{ b }} /> → t("Yan dal {b}", { b }).
 */
export function Tr({ s, vars }: { s: string; vars?: TVars }) {
  const t = useT();
  return <>{t(s, vars)}</>;
}
