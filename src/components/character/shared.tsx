"use client";
// Schwarzesonne ve Umbra Caelis karakter kağıtlarının ortak parçaları.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGo } from "@/components/app-link";
import { Modal, useAction } from "@/components/interactive";
import { Button, Card, Field, cx } from "@/components/ui";
import type { Character, InventoryItem } from "@/db/schema";
import { api } from "@/lib/client";
import { useT } from "@/i18n/client";

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
type InvChar = Pick<Character, "id" | "inventory" | "money" | "notes" | "gmNotes">;

export function Resource({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "accent" | "danger" | "warn" }) {
  return (
    <div
      className={cx(
        "rounded-xl border bg-surface px-3 py-2.5",
        tone === "accent" ? "border-accent/50" : tone === "danger" ? "border-danger/50" : tone === "warn" ? "border-warn/50" : "border-line",
      )}
    >
      <p lang={/^(Inspiration|Death Save|Reichsmark|Corruption)$/.test(label) ? "en" : undefined} className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={cx("font-mono text-xl", tone === "accent" && "text-accent", tone === "danger" && "text-danger", tone === "warn" && "text-warn")}>{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}


// ------------------------------------------------------------------ envanter
export function InventoryTab({
  c,
  isGM,
  canEdit,
  act,
  moneyLabel = "Reichsmark",
  gmPath,
}: {
  c: InvChar;
  isGM: boolean;
  canEdit: boolean;
  act: Act;
  moneyLabel?: string;
  /** GM notunun kaydedileceği uç (sisteme göre). */
  gmPath?: string;
}) {
  const t = useT();
  const [items, setItems] = useState<InventoryItem[]>(c.inventory);
  const [money, setMoney] = useState(c.money);
  const [notes, setNotes] = useState(c.notes);
  const [gmNotes, setGmNotes] = useState(c.gmNotes);
  const dirty = JSON.stringify(items) !== JSON.stringify(c.inventory) || money !== c.money || notes !== c.notes;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">{t("Envanter")}</h2>
          {canEdit && (
            <Button size="sm" onClick={() => setItems([...items, { id: Math.random().toString(36).slice(2, 10), name: "", qty: 1, note: "" }])}>
              {t("Eşya ekle")}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-muted">{t("Envanter boş.")}</p>}
          {items.map((it, i) => (
            <div key={it.id} className="grid grid-cols-[1fr_64px_auto] gap-2 sm:grid-cols-[1fr_64px_1fr_auto]">
              <input className="input" placeholder={t("Eşya")} value={it.name} disabled={!canEdit} maxLength={80} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className="input" type="number" min={0} max={9999} value={it.qty} disabled={!canEdit} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
              <input className="input order-last col-span-3 sm:order-none sm:col-span-1" placeholder={t("Not")} value={it.note} disabled={!canEdit} maxLength={200} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
              {canEdit && (
                <button type="button" className="px-2 text-muted hover:text-danger" aria-label={t("Sil")} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 max-w-xs">
          <Field label={moneyLabel}>
            <input className="input" type="number" value={money} disabled={!canEdit} onChange={(e) => setMoney(Number(e.target.value))} />
          </Field>
        </div>
      </Card>
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-3 font-serif text-lg">{t("Notlar")}</h2>
          <textarea className="input min-h-[180px]" value={notes} disabled={!canEdit} maxLength={8000} onChange={(e) => setNotes(e.target.value)} />
        </Card>
        {isGM && (
          <Card className="border-accent/30 p-5">
            <h2 className="mb-1 font-serif text-lg">{t("GM notları")}</h2>
            <p className="mb-3 text-xs text-muted">{t("Oyuncu bunu görmez.")}</p>
            <textarea className="input min-h-[120px]" value={gmNotes} maxLength={8000} onChange={(e) => setGmNotes(e.target.value)} />
            <Button size="sm" className="mt-3" disabled={gmNotes === c.gmNotes} onClick={() => act(() => api(gmPath ?? `/api/characters/${c.id}/gm`, { method: "PATCH", body: { gmNotes } }), t("GM notu kaydedildi."))}>
              {t("GM notunu kaydet")}
            </Button>
          </Card>
        )}
        {canEdit && (
          <Button
            variant="primary"
            disabled={!dirty || items.some((x) => !x.name.trim())}
            onClick={() => act(() => api(`/api/characters/${c.id}/sheet`, { method: "PATCH", body: { inventory: items, money, notes } }), t("Kaydedildi."))}
          >
            {t("Envanter ve notları kaydet")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ gizli notlar
export function SecretNotes({ c, canEdit, act }: { c: Pick<Character, "id" | "secretNotes">; canEdit: boolean; act: Act }) {
  const t = useT();
  const [v, setV] = useState(c.secretNotes);
  if (!canEdit) return null;
  return (
    <Card className="border-accent/30 p-5">
      <h2 className="font-serif text-lg">{t("GM'e özel notlar ve gizli geçmiş")}</h2>
      <p className="mb-3 text-xs text-muted">{t("Yalnızca sen ve GM görürsünüz. Diğer oyuncular bu alanı göremez.")}</p>
      <textarea className="input min-h-[120px]" value={v} maxLength={6000} onChange={(e) => setV(e.target.value)} placeholder={t("Sırlar, gizli bağlantılar, GM'den istediğin hikâye kancaları…")} />
      <Button size="sm" className="mt-3" disabled={v === c.secretNotes} onClick={() => act(() => api(`/api/characters/${c.id}/sheet`, { method: "PATCH", body: { secretNotes: v } }), t("Kaydedildi."))}>
        {t("Kaydet")}
      </Button>
    </Card>
  );
}

// ------------------------------------------------------------------ silme
export function ProfileEditor({ c, small }: { c: Pick<Character, "id" | "name" | "background" | "appearance">; small?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(c.name);
  const [background, setBackground] = useState(c.background);
  const [appearance, setAppearance] = useState(c.appearance);
  const start = () => {
    setName(c.name);
    setBackground(c.background);
    setAppearance(c.appearance);
    setOpen(true);
  };
  const n = name.trim().replace(/\s+/g, " ");
  const changed = n !== c.name || background.trim() !== c.background || appearance.trim() !== c.appearance;
  const valid = n.length >= 2 && n.length <= 60;
  const save = async () => {
    const body: Record<string, string> = {};
    if (n !== c.name) body.name = n;
    if (background.trim() !== c.background) body.background = background;
    if (appearance.trim() !== c.appearance) body.appearance = appearance;
    const r = await run(() => api(`/api/characters/${c.id}/profile`, { method: "PATCH", body }), t("Profil güncellendi."));
    if (r !== undefined) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      <Button size={small ? "sm" : undefined} variant="outline" onClick={start}>
        {small ? t("Düzenle") : t("İsim / açıklama")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("Karakter profili")}>
        <div className="space-y-4">
          <Field label={t("İsim")}>
            <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          {!valid && <p className="-mt-2 text-xs text-danger">{t("İsim 2–60 karakter olmalı.")}</p>}
          <Field label={t("Geçmiş ({n}/4000)", { n: background.length })}>
            <textarea className="input min-h-40" value={background} maxLength={4000} onChange={(e) => setBackground(e.target.value)} placeholder={t("Karakterin hikâyesi, kökeni, motivasyonu…")} />
          </Field>
          <Field label={t("Görünüş ({n}/1000)", { n: appearance.length })}>
            <textarea className="input min-h-24" value={appearance} maxLength={1000} onChange={(e) => setAppearance(e.target.value)} placeholder={t("Dış görünüş, kıyafet, ayırt edici izler…")} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>{t("Vazgeç")}</Button>
            <Button variant="primary" disabled={busy || !changed || !valid} onClick={save}>
              {t("Kaydet")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function DeleteCharacter({ id, name, afterHref }: { id: string; name: string; afterHref: string }) {
  const t = useT();
  const go = useGo();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {t("Karakteri sil")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("Karakteri sil")}>
        <div className="space-y-4">
          <p className="text-sm text-ink/90">
            <strong>{name}</strong>{" "}
            {t("kalıcı olarak silinecek: statlar, yetenekler, envanter, notlar, portre ve kayıt. Bu işlem geri alınamaz. Oyun odasındaki eski mesajlar ve zarlar kalır.")}
          </p>
          <Field label={t("Onaylamak için karakterin adını yaz")}>
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={name} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>{t("Vazgeç")}</Button>
            <Button
              variant="danger"
              disabled={busy || confirm.trim() !== name}
              onClick={async () => {
                const ok = await run(() => api(`/api/characters/${id}`, { method: "DELETE", body: { confirmName: confirm.trim() } }), t("Karakter silindi."));
                if (ok) go(afterHref, { replace: true });
              }}
            >
              {t("Kalıcı olarak sil")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
