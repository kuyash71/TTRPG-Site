"use client";

interface Props {
  name: string;
  backstory: string;
  onChange: (updates: { name?: string; backstory?: string }) => void;
}

export function WizardStepDetails({ name, backstory, onChange }: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="heading-gothic text-lg font-semibold text-zinc-100">
        Karakter Detayları
      </h2>

      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          Karakter Adı <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Karakterinizin adı..."
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-zinc-400">
          Hikaye / Backstory
        </label>
        <textarea
          value={backstory}
          onChange={(e) => onChange({ backstory: e.target.value })}
          rows={6}
          placeholder="Karakterinizin geçmişi, motivasyonları..."
          className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
