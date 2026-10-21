"use client";
import { useT } from "@/i18n/client";

/** Durum rozetinin metni: STATUS_LABEL Türkçe kalır, gösterirken çevrilir. */
export function StatusText({ label }: { label: string }) {
  const t = useT();
  return <>{t(label)}</>;
}
