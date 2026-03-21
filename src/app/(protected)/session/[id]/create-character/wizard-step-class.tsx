"use client";

import type { WizardClass } from "./character-wizard";

interface Props {
  classes: WizardClass[];
  selectedClassId: string | null;
  onSelect: (classId: string) => void;
}

export function WizardStepClass({ classes, selectedClassId, onSelect }: Props) {
  if (classes.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500">
        Bu gameset&apos;te henüz sınıf tanımlanmamış. GM&apos;e bildirin.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="heading-gothic mb-4 text-lg font-semibold text-zinc-100">
        Sınıf Seçin
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => onSelect(cls.id)}
            className={`rounded-lg border p-4 text-left transition-all ${
              selectedClassId === cls.id
                ? "border-gold-400 bg-gold-900/20 shadow-lg shadow-gold-400/10"
                : "border-border bg-surface hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="heading-gothic text-sm font-semibold text-zinc-100">
                {cls.name}
              </h3>
              <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-zinc-400">
                d{cls.hitDie}
              </span>
            </div>
            {cls.description && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-3">
                {cls.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
