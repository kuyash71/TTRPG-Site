"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, translateLoose, type Locale, type TFn } from "./core";

const Ctx = createContext<Locale>("tr");

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}
export const useLocale = () => useContext(Ctx);
export function useT(): TFn {
  const loc = useContext(Ctx);
  return useMemo(() => makeT(loc), [loc]);
}
/** Kayda Türkçe yazılmış metinleri (zar notu, kayıt, kural motoru uyarısı) göstermek için. */
export function useTLoose(): (s: string) => string {
  const loc = useContext(Ctx);
  return useMemo(() => (s: string) => translateLoose(loc, s), [loc]);
}
