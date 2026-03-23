"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, translations, TranslationKey } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "umbracaelis-locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === "en" || saved === "tr") {
      setLocaleState(saved);
    }
  }, []);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }

  function t(key: TranslationKey): string {
    const entry = translations[key];
    if (!entry) return key;
    return entry[locale] || entry.tr || key;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
