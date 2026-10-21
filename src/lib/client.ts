"use client";
import { localeFromHeaders, translate, type Locale } from "../i18n/core";
import { withBase } from "./base";

/** Tarayıcıdaki arayüz dili: dil çerezi, yoksa <html lang>, yoksa tarayıcı dili. */
function clientLocale(): Locale {
  if (typeof document === "undefined") return "tr";
  const lang = document.documentElement.lang || (typeof navigator !== "undefined" ? navigator.language : "");
  return localeFromHeaders(document.cookie, lang);
}

/** Uygulama API'sine JSON isteği; hata durumunda sunucunun mesajını fırlatır. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(withBase(path), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* gövdesiz cevap */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? translate(clientLocale(), "İstek başarısız ({status})", { status: res.status });
    if (res.status === 401 && typeof window !== "undefined") window.location.href = withBase("/giris");
    throw new Error(msg);
  }
  return data as T;
}
