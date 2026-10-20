"use client";
import { Languages, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal, useAction } from "@/components/interactive";
import { Badge, Button, Card, cx } from "@/components/ui";
import { api } from "@/lib/client";

/** Oluşturma sihirbazı: listeden tam `slots` kadar dil seçimi (ilk seçilen ana dil). */
export function LanguagePicker({ list, slots, value, onChange }: { list: readonly string[]; slots: number; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = q.trim().toLocaleLowerCase("tr-TR");
    return [...list].sort((a, b) => a.localeCompare(b, "tr")).filter((l) => !n || l.toLocaleLowerCase("tr-TR").includes(n));
  }, [list, q]);
  const toggle = (l: string) => onChange(value.includes(l) ? value.filter((x) => x !== l) : value.length < slots ? [...value, l] : value);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <Languages className="h-5 w-5 text-accent" />
        <span className="min-w-0 flex-1">
          <strong className="text-ink">{slots} dil</strong> seç. İlk seçtiğin <strong className="text-ink">ana dilin</strong> olur.
          <span className="block text-xs text-muted">Varsayılan 2 dil (ana dil + 1). Monolingual perki 1, çok dil bilen perk (Trilingual / Polyglot) 3 dil verir.</span>
        </span>
        <span className={cx("rounded-md px-2 py-1 font-mono", value.length === slots ? "bg-ok/15 text-ok" : "bg-accent/15 text-accent")}>
          {value.length}/{slots}
        </span>
      </Card>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((l, i) => (
            <button key={l} type="button" onClick={() => toggle(l)} className="chip border-accent text-accent" title="Kaldır">
              {i === 0 && <span className="text-[10px] font-semibold uppercase tracking-wider">ana dil ·</span>} {l} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <input className="input max-w-xs" placeholder="Dil ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((l) => {
          const on = value.includes(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              disabled={!on && value.length >= slots}
              onClick={() => toggle(l)}
              className={cx("rounded-md border px-3 py-2 text-left text-sm transition disabled:opacity-40", on ? "border-accent bg-accent/20 font-medium text-ink ring-1 ring-accent/60" : "border-line text-ink/85 hover:border-accent/50")}
            >
              {on && "✓ "}
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Karakter kağıdında diller; GM ekleyip değiştirebilir. */
export function LanguagesCard({ characterId, languages, list, isGM, onSaved }: { characterId: string; languages: string[]; list: readonly string[]; isGM: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <Languages className="h-4 w-4 text-accent" /> Diller
        </h2>
        {isGM && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {languages.length ? "Düzenle" : "Dil ekle"}
          </Button>
        )}
      </div>
      {languages.length === 0 ? (
        <p className="text-sm text-muted">{isGM ? "Dil seçilmemiş. Karakterin bildiği dilleri buradan ekleyebilirsin." : "Dil seçilmemiş; GM ekleyecek."}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5" data-testid="languages">
          {languages.map((l, i) => (
            <Badge key={l} tone={i === 0 ? "accent" : "neutral"} title={i === 0 ? "Ana dil" : undefined}>
              {l}
              {i === 0 && " · ana dil"}
            </Badge>
          ))}
        </div>
      )}
      {isGM && <LanguageEditor key={`${open}`} open={open} onClose={() => setOpen(false)} characterId={characterId} initial={languages} list={list} onSaved={onSaved} />}
    </Card>
  );
}

function LanguageEditor({ open, onClose, characterId, initial, list, onSaved }: { open: boolean; onClose: () => void; characterId: string; initial: string[]; list: readonly string[]; onSaved: () => void }) {
  const { busy, run } = useAction();
  const [v, setV] = useState<string[]>(initial);
  const [custom, setCustom] = useState("");
  const [q, setQ] = useState("");
  const n = q.trim().toLocaleLowerCase("tr-TR");
  const shown = [...list].sort((a, b) => a.localeCompare(b, "tr")).filter((l) => !n || l.toLocaleLowerCase("tr-TR").includes(n));
  const toggle = (l: string) => setV((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l].slice(0, 12)));
  const move = (i: number) => setV((x) => [x[i], ...x.filter((_, j) => j !== i)]);
  return (
    <Modal open={open} onClose={onClose} title="Dilleri düzenle" wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">GM olarak sınır yok: listeden seç ya da listede olmayan bir dili elle ekle. İlk dil ana dildir; bir dili ana dil yapmak için üstüne tıkla.</p>
        <div className="flex min-h-9 flex-wrap gap-2">
          {v.length === 0 && <span className="text-sm text-muted">Seçili dil yok.</span>}
          {v.map((l, i) => (
            <span key={l} className={cx("chip", i === 0 && "border-accent text-accent")}>
              <button type="button" onClick={() => move(i)} title="Ana dil yap">
                {i === 0 ? "★ " : ""}
                {l}
              </button>
              <button type="button" aria-label={`${l} kaldır`} onClick={() => toggle(l)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = custom.trim();
            if (c && !v.includes(c)) setV([...v, c].slice(0, 12));
            setCustom("");
          }}
        >
          <input className="input" placeholder="Listede olmayan dil (ör. Eski Rün dili)" maxLength={40} value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button type="submit" disabled={!custom.trim()}>
            Ekle
          </Button>
        </form>
        {list.length > 0 && (
          <>
            <input className="input max-w-xs" placeholder="Listede ara…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
              {shown.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggle(l)}
                  className={cx("rounded-md border px-3 py-1.5 text-left text-sm", v.includes(l) ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/85 hover:border-accent/50")}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Vazgeç</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              const ok = await run(() => api(`/api/characters/${characterId}/languages`, { method: "PATCH", body: { languages: v } }), "Diller kaydedildi.");
              if (ok !== undefined) {
                onClose();
                onSaved();
              }
            }}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
