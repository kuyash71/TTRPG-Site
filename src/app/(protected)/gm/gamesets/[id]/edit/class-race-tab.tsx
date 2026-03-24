"use client";

import { useState } from "react";
import type { ClassData, RaceData } from "./gameset-editor";

interface Props {
  gamesetId: string;
  classes: ClassData[];
  races: RaceData[];
  hpSystem: string;
  onUpdateClasses: (classes: ClassData[]) => void;
  onUpdateRaces: (races: RaceData[]) => void;
}

export function ClassRaceTab({
  gamesetId,
  classes,
  races,
  hpSystem,
  onUpdateClasses,
  onUpdateRaces,
}: Props) {
  const [section, setSection] = useState<"classes" | "races">("classes");

  return (
    <div>
      {/* Alt sekme */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSection("classes")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            section === "classes"
              ? "bg-gold-600 text-void"
              : "bg-surface text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Sınıflar ({classes.length})
        </button>
        <button
          onClick={() => setSection("races")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            section === "races"
              ? "bg-gold-600 text-void"
              : "bg-surface text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Irklar ({races.length})
        </button>
      </div>

      {section === "classes" ? (
        <ClassSection
          gamesetId={gamesetId}
          classes={classes}
          hpSystem={hpSystem}
          onUpdate={onUpdateClasses}
        />
      ) : (
        <RaceSection
          gamesetId={gamesetId}
          races={races}
          onUpdate={onUpdateRaces}
        />
      )}
    </div>
  );
}

// ─── Classes ────────────────────────────────────────────

function ClassSection({
  gamesetId,
  classes,
  hpSystem,
  onUpdate,
}: {
  gamesetId: string;
  classes: ClassData[];
  hpSystem: string;
  onUpdate: (c: ClassData[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClassData | null>(null);
  const [form, setForm] = useState({ name: "", description: "", hitDie: 8 });

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", hitDie: 8 });
    setShowForm(true);
  }

  function openEdit(cls: ClassData) {
    setEditing(cls);
    setForm({
      name: cls.name,
      description: cls.description,
      hitDie: cls.hitDie,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (editing) {
      const res = await fetch(
        `/api/gamesets/${gamesetId}/classes/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) return;
      const updated = await res.json();
      onUpdate(
        classes.map((c) =>
          c.id === editing.id ? { ...c, ...updated } : c
        )
      );
    } else {
      const res = await fetch(`/api/gamesets/${gamesetId}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) return;
      const created = await res.json();
      onUpdate([...classes, { ...created, subclasses: [] }]);
    }
    setShowForm(false);
  }

  async function handleDelete(classId: string) {
    const res = await fetch(
      `/api/gamesets/${gamesetId}/classes/${classId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    onUpdate(classes.filter((c) => c.id !== classId));
  }

  async function addSubclass(classId: string, name: string) {
    const res = await fetch(
      `/api/gamesets/${gamesetId}/classes/${classId}/subclasses`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }
    );
    if (!res.ok) return;
    const sub = await res.json();
    onUpdate(
      classes.map((c) =>
        c.id === classId
          ? { ...c, subclasses: [...c.subclasses, sub] }
          : c
      )
    );
  }

  async function deleteSubclass(subId: string) {
    const res = await fetch(
      `/api/gamesets/${gamesetId}/subclasses/${subId}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    onUpdate(
      classes.map((c) => ({
        ...c,
        subclasses: c.subclasses.filter((s) => s.id !== subId),
      }))
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="heading-gothic text-sm font-semibold text-zinc-200">
          Sınıflar
        </h3>
        <button
          onClick={openNew}
          className="rounded-md bg-gold-600 px-3 py-1.5 text-xs font-medium text-void hover:bg-gold-500"
        >
          + Sınıf Ekle
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((cls) => (
          <div
            key={cls.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-zinc-100">
                  {cls.name}
                </h4>
                {hpSystem === "hit-die" && (
                  <p className="text-xs text-zinc-500">
                    Hit Die: d{cls.hitDie}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(cls)}
                  className="text-xs text-zinc-500 hover:text-lavender-400"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(cls.id)}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Sil
                </button>
              </div>
            </div>
            {cls.description && (
              <p className="mb-2 text-xs text-zinc-400">{cls.description}</p>
            )}

            {/* Alt sınıflar */}
            <div className="mt-2 space-y-1">
              {cls.subclasses.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded bg-void px-2 py-1"
                >
                  <span className="text-xs text-zinc-300">
                    {sub.name}{" "}
                    <span className="text-zinc-600">
                      (Lv.{sub.unlockLevel})
                    </span>
                  </span>
                  <button
                    onClick={() => deleteSubclass(sub.id)}
                    className="text-xs text-zinc-600 hover:text-red-400"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <InlineAddButton
                placeholder="Alt sınıf adı..."
                onAdd={(name) => addSubclass(cls.id, name)}
              />
            </div>
          </div>
        ))}
      </div>

      {classes.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-600">
          Henüz sınıf tanımlanmadı.
        </p>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
            <h4 className="heading-gothic mb-4 text-sm font-semibold text-zinc-100">
              {editing ? "Sınıf Düzenle" : "Yeni Sınıf"}
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Sınıf adı"
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Açıklama"
                rows={3}
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />
              {hpSystem === "hit-die" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Hit Die
                  </label>
                  <select
                    value={form.hitDie}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hitDie: Number(e.target.value) }))
                    }
                    className="rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
                  >
                    {[4, 6, 8, 10, 12].map((d) => (
                      <option key={d} value={d}>
                        d{d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-md bg-gold-600 px-4 py-2 text-sm font-medium text-void hover:bg-gold-500"
                >
                  {editing ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Races ──────────────────────────────────────────────

function RaceSection({
  gamesetId,
  races,
  onUpdate,
}: {
  gamesetId: string;
  races: RaceData[];
  onUpdate: (r: RaceData[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RaceData | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    racialTraits: [] as { name: string; description: string }[],
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "", racialTraits: [] });
    setShowForm(true);
  }

  function openEdit(race: RaceData) {
    setEditing(race);
    setForm({
      name: race.name,
      description: race.description,
      racialTraits: race.racialTraits,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (editing) {
      const res = await fetch(
        `/api/gamesets/${gamesetId}/races/${editing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) return;
      const updated = await res.json();
      onUpdate(
        races.map((r) => (r.id === editing.id ? { ...r, ...updated } : r))
      );
    } else {
      const res = await fetch(`/api/gamesets/${gamesetId}/races`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) return;
      const created = await res.json();
      onUpdate([...races, created]);
    }
    setShowForm(false);
  }

  async function handleDelete(raceId: string) {
    const res = await fetch(`/api/gamesets/${gamesetId}/races/${raceId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error);
      return;
    }
    onUpdate(races.filter((r) => r.id !== raceId));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="heading-gothic text-sm font-semibold text-zinc-200">
          Irklar
        </h3>
        <button
          onClick={openNew}
          className="rounded-md bg-gold-600 px-3 py-1.5 text-xs font-medium text-void hover:bg-gold-500"
        >
          + Irk Ekle
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {races.map((race) => (
          <div
            key={race.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-2 flex items-start justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">
                {race.name}
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(race)}
                  className="text-xs text-zinc-500 hover:text-lavender-400"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(race.id)}
                  className="text-xs text-zinc-500 hover:text-red-400"
                >
                  Sil
                </button>
              </div>
            </div>
            {race.description && (
              <p className="mb-2 text-xs text-zinc-400">{race.description}</p>
            )}
            {race.racialTraits.length > 0 && (
              <div className="space-y-1">
                {race.racialTraits.map((t, i) => (
                  <div key={i} className="rounded bg-void px-2 py-1">
                    <span className="text-xs font-medium text-lavender-400">
                      {t.name}
                    </span>
                    {t.description && (
                      <span className="ml-1 text-xs text-zinc-500">
                        — {t.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {races.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-600">
          Henüz ırk tanımlanmadı.
        </p>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
            <h4 className="heading-gothic mb-4 text-sm font-semibold text-zinc-100">
              {editing ? "Irk Düzenle" : "Yeni Irk"}
            </h4>
            <div className="space-y-3">
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Irk adı"
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Açıklama"
                rows={2}
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
              />

              {/* Racial Traits */}
              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Irk Özellikleri
                </label>
                {form.racialTraits.map((trait, i) => (
                  <div key={i} className="mb-1 flex gap-1">
                    <input
                      type="text"
                      value={trait.name}
                      onChange={(e) => {
                        const updated = [...form.racialTraits];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setForm((f) => ({ ...f, racialTraits: updated }));
                      }}
                      placeholder="Özellik adı"
                      className="flex-1 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={trait.description}
                      onChange={(e) => {
                        const updated = [...form.racialTraits];
                        updated[i] = {
                          ...updated[i],
                          description: e.target.value,
                        };
                        setForm((f) => ({ ...f, racialTraits: updated }));
                      }}
                      placeholder="Açıklama"
                      className="flex-1 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const updated = form.racialTraits.filter(
                          (_, j) => j !== i
                        );
                        setForm((f) => ({ ...f, racialTraits: updated }));
                      }}
                      className="text-xs text-zinc-600 hover:text-red-400"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      racialTraits: [
                        ...f.racialTraits,
                        { name: "", description: "" },
                      ],
                    }))
                  }
                  className="mt-1 text-xs text-lavender-400 hover:text-lavender-300"
                >
                  + Özellik Ekle
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-md bg-gold-600 px-4 py-2 text-sm font-medium text-void hover:bg-gold-500"
                >
                  {editing ? "Güncelle" : "Oluştur"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Add Button ──────────────────────────────────

function InlineAddButton({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-600 hover:text-lavender-400"
      >
        + Ekle
      </button>
    );
  }

  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim());
            setName("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoFocus
        className="flex-1 rounded border border-border bg-void px-2 py-1 text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
      />
      <button
        onClick={() => {
          if (name.trim()) {
            onAdd(name.trim());
            setName("");
          }
          setOpen(false);
        }}
        className="text-xs text-lavender-400"
      >
        OK
      </button>
    </div>
  );
}
