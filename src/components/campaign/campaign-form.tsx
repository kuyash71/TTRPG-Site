"use client";
import { useRouter } from "next/navigation";
import { useGo } from "@/components/app-link";
import { campaignHref, type Sys } from "@/lib/links";
import { SunLogo } from "@/components/logo";
import { useState } from "react";
import { useAction } from "@/components/interactive";
import { Button, Field, cx } from "@/components/ui";
import { api } from "@/lib/client";
import type { CampaignInfo } from "@/lib/shz/content-types";
import { useT } from "@/i18n/client";

export interface CampaignValues {
  name: string;
  contentKey: string | null;
  description: string;
  startPerkPoints: number;
  levelCap: number;
  deathSaveEnabled: boolean;
  physicalDice: boolean;
  status?: "ACTIVE" | "PAUSED" | "ARCHIVED";
}

export function CampaignForm({ id, initial, presets, system = "SHZ" }: { id?: string; initial?: CampaignValues; presets: CampaignInfo[]; system?: Sys }) {
  const t = useT();
  const router = useRouter();
  const go = useGo();
  const { busy, run } = useAction();
  const [v, setV] = useState<CampaignValues>(
    initial ?? { name: "", contentKey: null, description: "", startPerkPoints: 2, levelCap: system === "UC" ? 15 : 10, deathSaveEnabled: true, physicalDice: false },
  );
  const set = <K extends keyof CampaignValues>(k: K, val: CampaignValues[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (id) {
          await run(() => api(`/api/campaigns/${id}`, { method: "PATCH", body: v }), t("Kampanya kaydedildi."));
          router.refresh();
        } else {
          const r = await run(() => api<{ id: string }>("/api/campaigns", { body: { ...v, system } }));
          if (r) go(campaignHref(system, r.id));
        }
      }}
    >
      {presets.length > 0 && (
      <div>
        <span className="label">{t("Hikâye")}</span>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((p) => (
            <button
              type="button"
              key={p.key}
              onClick={() => {
                set("contentKey", v.contentKey === p.key ? null : p.key);
                if (!v.name) set("name", p.name);
              }}
              className={cx(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                v.contentKey === p.key ? "border-accent bg-accent/10" : "border-line bg-surface2/40 hover:border-accent/40",
              )}
            >
              {p.emblem ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/schwarzesonne${p.emblem}`} alt="" className="h-10 w-10 shrink-0 object-contain" />
              ) : (
                <SunLogo className="h-10 w-10 shrink-0 text-accent" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{p.name}</span>
                <span className="block text-[11px] text-muted">
                  {p.difficulty} · {p.length}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{t("İsteğe bağlı. Kendi hikâyeni anlatıyorsan boş bırak.")}</p>
      </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Kampanya adı")}>
          <input value={v.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} className="input" />
        </Field>
        {id && (
          <Field label={t("Durum")}>
            <select value={v.status} onChange={(e) => set("status", e.target.value as CampaignValues["status"])} className="input">
              <option value="ACTIVE">{t("Aktif")}</option>
              <option value="PAUSED">{t("Duraklatıldı")}</option>
              <option value="ARCHIVED">{t("Arşiv")}</option>
            </select>
          </Field>
        )}
      </div>
      <Field label={t("Açıklama")} hint={t("Oyunculara görünen kısa tanıtım")}>
        <textarea value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} rows={3} className="input" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Başlangıç perk puanı")} hint={t("Önerilen +0 veya +2")}>
          <input type="number" min={0} max={10} value={v.startPerkPoints} onChange={(e) => set("startPerkPoints", Number(e.target.value))} className="input" />
        </Field>
        <Field label={t("Seviye sınırı")} hint={system === "UC" ? t("En fazla 15 (Zirve)") : t("10 (uzun kampanyalarda 15'e kadar)")}>
          <input type="number" min={1} max={15} value={v.levelCap} onChange={(e) => set("levelCap", Number(e.target.value))} className="input" />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-line bg-surface2/40 px-3 py-2.5 sm:mt-5 sm:self-start">
          <input type="checkbox" checked={v.deathSaveEnabled} onChange={(e) => set("deathSaveEnabled", e.target.checked)} className="h-4 w-4 accent-[rgb(186,168,240)]" />
          <span className="text-sm">{t("Death Save açık")}</span>
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-line bg-surface2/40 px-3 py-3">
        <input type="checkbox" checked={v.physicalDice} onChange={(e) => set("physicalDice", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(186,168,240)]" data-testid="physical-dice" />
        <span className="text-sm">
          <span className="font-medium text-ink">{t("Fiziksel atılmış zar")}</span>
          <span className="block text-xs text-muted">
            {t(
              "Masada gerçek zarla oynanan oyunlar için. Açıkken oyuncular odada dijital zar atamaz; GM eşiği, stat'ı, uzvu ya da {corruption} / Death Save durumunu seçip atılan zarı ve atan oyuncuyu girer, sistem başarıyı hesaplar.",
              { corruption: system === "UC" ? t("Yozlaşma") : "Corruption" },
            )}
          </span>
        </span>
      </label>
      <Button type="submit" variant="primary" disabled={busy}>
        {id ? t("Kaydet") : t("Kampanyayı oluştur")}
      </Button>
    </form>
  );
}
