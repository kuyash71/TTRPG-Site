import "server-only";
import type { NextRequest } from "next/server";
import { localeFromHeaders, translateLoose, type Locale } from "../i18n/core";
import { bad } from "./api";

/** İsteğin dili (çerez, yoksa Accept-Language). */
export function reqLocale(req: NextRequest): Locale {
  return localeFromHeaders(req.headers.get("cookie"), req.headers.get("accept-language"));
}

/**
 * Kural motorundan / yardımcı fonksiyonlardan gelen, fmt(...) ile doldurulmuş Türkçe metinler için 400 hatası:
 * metinler sözlük şablonlarıyla isteğin diline çevrilir, birden fazlaysa " · " ile birleştirilir.
 */
export function badLoose(req: NextRequest, texts: string | string[]) {
  const loc = reqLocale(req);
  return bad((Array.isArray(texts) ? texts : [texts]).map((t) => translateLoose(loc, t)).join(" · "));
}
