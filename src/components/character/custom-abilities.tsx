"use client";
import {
  Activity,
  Anchor,
  Atom,
  Axe,
  Binoculars,
  Bomb,
  BookOpen,
  Brain,
  Church,
  Cog,
  Crosshair,
  Crown,
  Dices,
  Drama,
  Droplet,
  Eye,
  Feather,
  Flag,
  FlaskConical,
  Flame,
  Footprints,
  Gem,
  Ghost,
  Hammer,
  Hand,
  HandHeart,
  HeartPulse,
  Hexagon,
  KeyRound,
  Link2,
  Megaphone,
  MoonStar,
  Pencil,
  Plus,
  ScrollText,
  Shield,
  Skull,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sword,
  Swords,
  Target,
  Trash2,
  Waves,
  WandSparkles,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/interactive";
import { Badge, Button, Field, cx } from "@/components/ui";
import type { CustomAbility } from "@/db/schema";
import { api } from "@/lib/client";
import { useT } from "@/i18n/client";

/** Özel yetenekler için sitedeki simge seti (sınıf, dal, ağaç ve yetenek simgelerinden). */
export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Star,
  Swords,
  Sword,
  Axe,
  Hammer,
  Shield,
  Crosshair,
  Target,
  Bomb,
  Flame,
  Zap,
  Snowflake,
  Wind,
  Waves,
  Droplet,
  Skull,
  Ghost,
  MoonStar,
  Sun,
  Eye,
  Binoculars,
  Footprints,
  Hand,
  HandHeart,
  HeartPulse,
  Activity,
  Brain,
  Atom,
  WandSparkles,
  Gem,
  Hexagon,
  Church,
  ScrollText,
  BookOpen,
  Feather,
  Megaphone,
  Crown,
  Flag,
  Drama,
  FlaskConical,
  Cog,
  KeyRound,
  Link2,
  Anchor,
  Dices,
};
const TYPE_STYLE: Record<string, string> = {
  Aktif: "border-accent/35 bg-accent/10 text-accent",
  Pasif: "border-line bg-surface2 text-ink/80",
  Tepki: "border-warn/40 bg-warn/10 text-warn",
};

export function CustomAbilityIcon({ icon, type, className }: { icon: string; type: string; className?: string }) {
  const I = CUSTOM_ICONS[icon] ?? Sparkles;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border", TYPE_STYLE[type] ?? TYPE_STYLE.Pasif, className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}

function Block({ label, tone, children }: { label: string; tone?: "danger" | "lav" | "accent"; children: string }) {
  const t = useT();
  return (
    <div
      className={cx(
        "rounded-lg border-l-[3px] px-3 py-2.5",
        tone === "danger" ? "border-danger/70 bg-danger/[0.07]" : tone === "lav" ? "border-lav/70 bg-lav/[0.07]" : tone === "accent" ? "border-accent/60 bg-accent/[0.06]" : "border-line bg-surface2/50",
      )}
    >
      <p className={cx("mb-1 text-[11px] font-semibold uppercase tracking-widest", tone === "danger" ? "text-danger" : tone === "lav" ? "text-lav" : tone === "accent" ? "text-accent" : "text-muted")}>{t(label)}</p>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{children}</p>
    </div>
  );
}

/** GM'in yazdığı özel yeteneğin kartı (resmi yetenek kartlarıyla aynı düzen). */
export function CustomAbilityCard({ ability: a, actions }: { ability: CustomAbility; actions?: React.ReactNode }) {
  const t = useT();
  return (
    <article className={cx("card flex flex-col p-4", a.level > 0 ? "border-accent ring-1 ring-accent/60" : "opacity-90")} data-testid={`custom-${a.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CustomAbilityIcon icon={a.icon} type={a.type} />
          <div className="min-w-0">
            <h3 className="font-serif text-lg leading-snug text-ink">{a.name}</h3>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-lav">{t("Özel yetenek · GM")}</p>
          </div>
        </div>
        <span className={cx("shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px]", a.level > 0 ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted")}>
          {a.level > 0 ? t("Sv {level}/{max}", { level: a.level, max: a.maxLevel }) : t("{max} sv · açılmadı", { max: a.maxLevel })}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={a.type === "Aktif" ? "accent" : a.type === "Tepki" ? "warn" : "neutral"}>{t(a.type)}</Badge>
      </div>
      {a.requirement && (
        <p className="mt-2 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wider">{t("Gereksinim:")}</span> <span className="text-ink/90">{a.requirement}</span>
        </p>
      )}
      <div className="mt-3 space-y-3">
        {a.maxLevel > 1 ? (
          <ol className="space-y-2">
            {a.levels.map((txt, i) => (
              <li key={i} className={cx("grid grid-cols-[52px_1fr] gap-3 rounded-lg border px-3 py-2.5", i < a.level ? "border-accent/40 bg-accent/[0.05]" : "border-line bg-surface2/50")}>
                <span className="grid h-7 place-items-center rounded-md bg-surface font-mono text-xs font-semibold text-accent">{t("Sv {n}", { n: i + 1 })}</span>
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{txt}</p>
              </li>
            ))}
          </ol>
        ) : (
          <Block label="Etki" tone="accent">
            {a.levels[0] ?? ""}
          </Block>
        )}
        {a.cost && (
          <Block label="Bedel" tone="danger">
            {a.cost}
          </Block>
        )}
        {a.synergy && (
          <Block label="Sinerji" tone="lav">
            {a.synergy}
          </Block>
        )}
        {a.note && <Block label="Not">{a.note}</Block>}
        {a.flavor && <p className="border-t border-line pt-2 text-sm italic text-muted">{a.flavor}</p>}
      </div>
      {actions && <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">{actions}</div>}
    </article>
  );
}

const EMPTY: Omit<CustomAbility, "id"> = { name: "", icon: "Sparkles", type: "Aktif", maxLevel: 1, level: 1, levels: [""], requirement: "", cost: "", synergy: "", note: "", flavor: "" };

function Editor({ open, onClose, characterId, initial, onSaved }: { open: boolean; onClose: () => void; characterId: string; initial: CustomAbility | null; onSaved: () => void }) {
  const t = useT();
  const [v, setV] = useState<Omit<CustomAbility, "id"> & { id?: string }>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setMax = (m: 1 | 2 | 3) => setV({ ...v, maxLevel: m, levels: Array.from({ length: m }, (_, i) => v.levels[i] ?? ""), level: Math.min(v.level, m) });
  const valid = v.name.trim().length >= 2 && v.levels.every((x) => x.trim().length > 0);
  return (
    <Modal open={open} onClose={onClose} title={initial ? t("Özel yeteneği düzenle") : t("Özel yetenek ekle")} wide>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t("Özel yetenekler yalnızca bu karaktere aittir, yetenek puanı harcatmaz ve katman kurallarına girmez. Seviyesini sen ayarlarsın.")}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label={t("Ad")}>
            <input className="input" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} data-testid="custom-name" />
          </Field>
          <Field label={t("Tip")}>
            <select className="input" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as CustomAbility["type"] })}>
              <option value="Aktif">{t("Aktif")}</option>
              <option value="Pasif">{t("Pasif")}</option>
              <option value="Tepki">{t("Tepki")}</option>
            </select>
          </Field>
        </div>
        <div>
          <span className="label">{t("Simge")}</span>
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12" role="radiogroup" aria-label={t("Simge")}>
            {Object.entries(CUSTOM_ICONS).map(([k, I]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={v.icon === k}
                aria-label={k}
                title={k}
                onClick={() => setV({ ...v, icon: k })}
                className={cx("grid h-9 place-items-center rounded-md border transition", v.icon === k ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-ink")}
              >
                <I className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Seviye sayısı")}>
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMax(m)} className={cx("h-9 flex-1 rounded-md border text-sm", v.maxLevel === m ? "border-accent bg-accent/15 text-ink" : "border-line text-muted")}>
                  {m === 1 ? t("Tek seviye") : t("{n} seviye", { n: m })}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("Karakterin mevcut seviyesi")} hint={t("0: yazılı ama henüz açılmamış")}>
            <select className="input" value={v.level} onChange={(e) => setV({ ...v, level: Number(e.target.value) })} data-testid="custom-level">
              {Array.from({ length: v.maxLevel + 1 }).map((_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? t("0 · açılmadı") : t("Sv {n}", { n: i })}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {v.levels.map((txt, i) => (
          <Field key={i} label={v.maxLevel === 1 ? t("Etki") : t("Seviye {n} etkisi", { n: i + 1 })}>
            <textarea className="input" rows={3} maxLength={2000} value={txt} onChange={(e) => setV({ ...v, levels: v.levels.map((x, j) => (j === i ? e.target.value : x)) })} data-testid={`custom-level-${i + 1}`} />
          </Field>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Gereksinim")}>
            <input className="input" maxLength={300} value={v.requirement} placeholder={t("ör. Sebahat 5, Sv 8")} onChange={(e) => setV({ ...v, requirement: e.target.value })} />
          </Field>
          <Field label={t("Bedel")}>
            <input className="input" maxLength={600} value={v.cost} placeholder={t("ör. +1 Yozlaşma")} onChange={(e) => setV({ ...v, cost: e.target.value })} />
          </Field>
          <Field label={t("Sinerji")}>
            <input className="input" maxLength={600} value={v.synergy} onChange={(e) => setV({ ...v, synergy: e.target.value })} />
          </Field>
          <Field label={t("Not")}>
            <input className="input" maxLength={1000} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          </Field>
        </div>
        <Field label={t("Açıklama (anlatı, isteğe bağlı)")}>
          <input className="input" maxLength={500} value={v.flavor} onChange={(e) => setV({ ...v, flavor: e.target.value })} />
        </Field>
        {err && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="primary"
            disabled={!valid || busy}
            data-testid="custom-save"
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await api(`/api/characters/${characterId}/custom-abilities`, { body: v });
                onSaved();
                onClose();
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Kaydet")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Karakter kâğıdındaki özel yetenekler bölümü: herkes görür, yalnızca GM ekler/düzenler/siler. */
export function CustomAbilitiesSection({ characterId, list, isGM, onSaved }: { characterId: string; list: CustomAbility[]; isGM: boolean; onSaved: () => void }) {
  const t = useT();
  const [edit, setEdit] = useState<CustomAbility | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!list.length && !isGM) return null;
  return (
    <section data-testid="custom-abilities">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="flex items-center gap-2 font-serif text-2xl">
          <Star className="h-5 w-5 text-lav" /> {t("Özel yetenekler")}
        </h2>
        {isGM && (
          <Button size="sm" variant="outline" onClick={() => setEdit("new")} data-testid="custom-add">
            <Plus className="h-4 w-4" /> {t("Özel yetenek ekle")}
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{t("Bu karaktere özel bir yetenek yazılmadı. GM olarak buradan, yalnızca bu karaktere ait bir yetenek ekleyebilirsin.")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((a) => (
            <CustomAbilityCard
              key={a.id}
              ability={a}
              actions={
                isGM ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEdit(a)}>
                      <Pencil className="h-4 w-4" /> {t("Düzenle")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.confirm(t("\"{name}\" silinsin mi?", { name: a.name }))) return;
                        setBusy(true);
                        try {
                          await api(`/api/characters/${characterId}/custom-abilities`, { method: "DELETE", body: { id: a.id } });
                          onSaved();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> {t("Sil")}
                    </Button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      {edit && <Editor key={edit === "new" ? "new" : edit.id} open onClose={() => setEdit(null)} characterId={characterId} initial={edit === "new" ? null : edit} onSaved={onSaved} />}
    </section>
  );
}
