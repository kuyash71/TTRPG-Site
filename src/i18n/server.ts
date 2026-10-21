import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, localeFromAcceptLanguage, makeT, translateLoose, type Locale, type TFn } from "./core";

/** İsteğin dili: "lang" çerezi, yoksa tarayıcı dili. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get("lang")?.value;
  if (isLocale(c)) return c;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export async function getT(): Promise<TFn> {
  return makeT(await getLocale());
}

export async function getTLoose(): Promise<(s: string) => string> {
  const loc = await getLocale();
  return (s) => translateLoose(loc, s);
}
