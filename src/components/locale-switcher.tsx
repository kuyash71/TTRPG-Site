"use client";

import { useLocale, Locale } from "@/lib/locale";

const flags: Record<Locale, string> = {
  tr: "TR",
  en: "EN",
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-void p-0.5">
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
            locale === l
              ? "bg-surface text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {flags[l]}
        </button>
      ))}
    </div>
  );
}
