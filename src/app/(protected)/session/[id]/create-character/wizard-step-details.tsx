"use client";

import type { CustomField } from "./character-wizard";

interface Props {
  name: string;
  backstory: string;
  customFields: CustomField[];
  onChange: (updates: { name?: string; backstory?: string; customFields?: CustomField[] }) => void;
}

export function WizardStepDetails({ name, backstory, customFields, onChange }: Props) {
  function addField() {
    if (customFields.length >= 5) return;
    onChange({
      customFields: [
        ...customFields,
        { id: crypto.randomUUID(), title: "", content: "", isPrivate: false },
      ],
    });
  }

  function updateField(id: string, updates: Partial<CustomField>) {
    onChange({
      customFields: customFields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    });
  }

  function removeField(id: string) {
    onChange({ customFields: customFields.filter((f) => f.id !== id) });
  }

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

      {/* Custom Fields */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">
            Ek Bilgiler
            <span className="ml-1 text-xs text-zinc-600">({customFields.length}/5)</span>
          </label>
          {customFields.length < 5 && (
            <button
              type="button"
              onClick={addField}
              className="rounded-md bg-surface-raised px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              + Ekle
            </button>
          )}
        </div>

        {customFields.map((field) => (
          <div
            key={field.id}
            className="rounded-md border border-border bg-surface p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={field.title}
                onChange={(e) => updateField(field.id, { title: e.target.value })}
                placeholder="Başlık (ör. Kişilik, Görünüm, Notlar...)"
                className="flex-1 rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => updateField(field.id, { isPrivate: !field.isPrivate })}
                className={`flex-shrink-0 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  field.isPrivate
                    ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                    : "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                }`}
                title={field.isPrivate ? "Gizli — sadece sen ve GM görebilir" : "Herkese açık"}
              >
                {field.isPrivate ? "Gizli" : "Açık"}
              </button>
              <button
                type="button"
                onClick={() => removeField(field.id)}
                className="flex-shrink-0 text-zinc-600 hover:text-red-400"
                title="Sil"
              >
                &times;
              </button>
            </div>
            <textarea
              value={field.content}
              onChange={(e) => updateField(field.id, { content: e.target.value })}
              rows={3}
              placeholder="İçerik..."
              className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
