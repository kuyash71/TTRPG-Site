"use client";

import type { WizardRace } from "./character-wizard";

interface Props {
  races: WizardRace[];
  selectedRaceId: string | null;
  onSelect: (raceId: string) => void;
}

export function WizardStepRace({ races, selectedRaceId, onSelect }: Props) {
  if (races.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500">
        Bu gameset&apos;te henüz ırk tanımlanmamış. GM&apos;e bildirin.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="heading-gothic mb-4 text-lg font-semibold text-zinc-100">
        Irk Seçin
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {races.map((race) => (
          <button
            key={race.id}
            onClick={() => onSelect(race.id)}
            className={`rounded-lg border p-4 text-left transition-all ${
              selectedRaceId === race.id
                ? "border-gold-400 bg-gold-900/20 shadow-lg shadow-gold-400/10"
                : "border-border bg-surface hover:border-zinc-600"
            }`}
          >
            <h3 className="heading-gothic text-sm font-semibold text-zinc-100">
              {race.name}
            </h3>
            {race.description && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                {race.description}
              </p>
            )}
            {race.racialTraits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {race.racialTraits.map((t, i) => (
                  <span
                    key={i}
                    className="rounded bg-lavender-900/30 px-1.5 py-0.5 text-[10px] text-lavender-400"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
