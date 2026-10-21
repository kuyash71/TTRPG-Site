"use client";
import { HeartPulse, Lock, MoonStar, Skull, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyDiagram, WoundLegend } from "@/components/body-diagram";
import { LanguagesCard } from "@/components/character/languages";
import { DeleteCharacter, InventoryTab, ProfileEditor, Resource, SecretNotes } from "@/components/character/shared";
import { CustomAbilitiesSection } from "@/components/character/custom-abilities";
import { Modal, SubTabs, Tabs, useAction, useHashTab } from "@/components/interactive";
import { Portrait, PortraitEditor } from "@/components/portrait";
import { Badge, Button, Card, Field, StatusBadge, cx } from "@/components/ui";
import { StatBadge, UcAbilityCard, UcHtml, UcPerkCard } from "@/components/uc/cards";
import { UcFaithPicker } from "@/components/uc/faith-picker";
import { UcMechanicsCard } from "@/components/uc/mechanics-card";
import { UcClassIcon, UcDalIcon } from "@/components/uc/icons";
import type { Character } from "@/db/schema";
import { useLocale, useT, useTLoose } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { api } from "@/lib/client";
import { UC_LANGUAGES } from "@/lib/languages";
import { BANDAGES, BODY_PARTS, WOUNDS, bodyPartLabel, type BodyPartKey } from "@/lib/shz/constants";
import { normalizeBody, woundPenalty } from "@/lib/shz/rules";
import { UC_STAT_KEYS, UC_STAT_LABELS, UC_TIER_OPEN } from "@/lib/uc/constants";
import type { UcAbility, UcFaith, UcPerk } from "@/lib/uc/content-types";
import { ucResolveFaith } from "@/lib/uc/faith";
import {
  UC_DECAY_EFFECTS,
  UC_DECAY_MAX,
  UC_FORK_INFO,
  UC_FORK_LEVELS,
  UC_STAT_MAX,
  ucBonusCap,
  ucDecayFloor,
  ucForkCounts,
  ucLearnState,
  ucNormalizeStats,
  ucOpenDalProblems,
  ucPendingFork,
  ucPerkBudget,
  ucPoints,
  ucRingOf,
  type UcCharLike,
  type UcForkLevel,
  type UcRules,
} from "@/lib/uc/rules";
import { ucTipFor } from "@/lib/uc/tips";

type Ch = Omit<Character, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
interface Log {
  id: string;
  kind: string;
  text: string;
  createdAt: string;
  actor: string | null;
}
type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
const TABS = ["genel", "yetenekler", "yozlasma", "beden", "envanter", "kayit"] as const;
type Tab = (typeof TABS)[number];

const asUc = (c: Ch): UcCharLike => ({
  level: c.level,
  stats: ucNormalizeStats(c.stats as unknown as Record<string, number>),
  trees: c.trees,
  abilities: c.abilities,
  perks: c.perks,
  body: c.body,
  corruption: c.corruption,
  inspiration: c.inspiration,
  uc: c.uc ?? {},
});

export function UcSheet({
  character: c,
  campaign,
  ownerName,
  isGM,
  isOwner,
  data,
  abilities,
  perks,
  logs,
  mechanics,
  faiths,
}: {
  character: Ch;
  campaign: { id: string; name: string; deathSaveEnabled: boolean; levelCap: number; startPerkPoints: number };
  ownerName: string;
  isGM: boolean;
  isOwner: boolean;
  data: UcRules;
  abilities: UcAbility[];
  perks: UcPerk[];
  logs: Log[];
  /** Dal mekanikleri (a.DAL "---" sonrası) */
  mechanics: Record<string, { title: string; html: string }>;
  /** Sınıfın inançları (Priest) */
  faiths?: UcFaith[];
}) {
  const t = useT();
  const tLoose = useTLoose();
  const loc = useLocale();
  const router = useRouter();
  const { busy, run } = useAction();
  const [tab, setTab] = useHashTab<Tab>(TABS, "genel");
  const faithLabel = ucResolveFaith(faiths, c.uc?.faithKey, c.uc?.faithDetail)?.label ?? c.uc?.faith;
  const [gmOpen, setGmOpen] = useState(false);
  const [perkOpen, setPerkOpen] = useState(false);
  const canAct = isGM || (isOwner && c.status === "ACTIVE");
  const u = useMemo(() => asUc(c), [c]);
  const pts = ucPoints(u, data);
  const ds = c.deathSave;
  const cls = data.classes.find((x) => x.key === c.uc?.classKey);
  const fork = ucPendingFork(c.corruption, c.uc?.forks);
  const openable = (isGM || isOwner) && canAct ? data.classes.find((x) => x.key === c.uc?.classKey)?.dals.filter((k) => ucOpenDalProblems(u, k, data).length === 0) ?? [] : [];
  const act: Act = async (fn, ok) => {
    const r = await run(fn, ok);
    if (r !== undefined) router.refresh();
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="flex min-w-0 items-start gap-5">
          {isGM || isOwner ? (
            <PortraitEditor id={c.id} version={c.portraitVersion} name={c.name} onChange={() => router.refresh()} />
          ) : (
            <Portrait id={c.id} version={c.portraitVersion} name={c.name} className="h-[150px] w-[120px]" />
          )}
          <div className="min-w-0">
            <p className="kicker mb-2">
              <a href={`/umbracaelis/kampanya/${campaign.id}`} className="hover:underline">
                Umbra Caelis · {campaign.name}
              </a>
            </p>
            <h1 className="flex flex-wrap items-center gap-3 text-3xl sm:text-4xl">
              {c.name} <StatusBadge status={c.status} />
            </h1>
            <p className="mt-2 text-sm text-muted">
              {ownerName} · {t("{n} yaş", { n: c.age })} · {t(c.nationality)} · {c.alignment}
              {faithLabel && ` · ${faithLabel}`}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {cls && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 py-0.5 pl-0.5 pr-2.5 text-xs text-accent">
                  <UcClassIcon classKey={cls.key} className="h-6 w-6 rounded-full" />
                  {cls.name}
                </span>
              )}
              {c.trees.map((k) => (
                <Badge key={k} tone={data.dals[k]?.tier === 2 ? "warn" : "accent"}>
                  {t("K{tier}", { tier: data.dals[k]?.tier })} · {data.dals[k]?.name ?? k}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a href={`/umbracaelis/kampanya/${campaign.id}/oda`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-onAccent hover:bg-accent/90">
            {t("Oyun odası")}
          </a>
          {isGM && (
            <Button variant="outline" onClick={() => setGmOpen(true)}>
              {t("GM düzenle")}
            </Button>
          )}
          {(isGM || isOwner) && <ProfileEditor c={c} />}
          {(isGM || isOwner) && <DeleteCharacter id={c.id} name={c.name} afterHref={`/umbracaelis/kampanya/${campaign.id}`} />}
        </div>
      </header>

      {c.status === "PENDING" && <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm">{t("Karakter GM onayı bekliyor. Onaylanınca puan harcayabilir ve oyun odasında zar atabilirsin.")}</div>}
      {c.status === "REJECTED" && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {c.reviewNote ? t("GM bu karakteri reddetti: {note}", { note: c.reviewNote }) : t("GM bu karakteri reddetti.")} {t("Kampanya sayfasından yeni bir karakter oluşturabilirsin.")}
        </div>
      )}
      {c.status === "DEAD" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-danger" /> <strong>{t("{name} öldü.", { name: c.name })}</strong>
          </span>
          {isGM && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api(`/api/uc/characters/${c.id}/gm`, { method: "PATCH", body: { revive: true } }), t("{name} diriltildi.", { name: c.name }))}>
              <HeartPulse className="h-4 w-4" /> {t("Dirilt")}
            </Button>
          )}
        </div>
      )}
      {c.perkEditAllowed && isOwner && c.status === "ACTIVE" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> {t("GM perklerini yeniden düzenlemene izin verdi (tek seferlik).")}
          </span>
          <Button size="sm" variant="primary" onClick={() => setPerkOpen(true)}>
            {t("Perkleri düzenle")}
          </Button>
        </div>
      )}
      {fork && (isGM || isOwner) && <ForkPrompt c={c} level={fork} act={act} busy={busy} />}
      {openable.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok/50 bg-ok/10 px-4 py-3">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ok">{t("YENİ KATMAN AÇILDI")}</p>
            <p className="text-sm text-ink/90">{t("K{tier} dallarından birini seç. Bekleyen sembol stat puanların seçtiğin dalın stat'ına eklenir.", { tier: data.dals[openable[0]].tier })}</p>
          </div>
          <Button variant="primary" onClick={() => setTab("yetenekler")}>
            {t("Dal seç")}
          </Button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
        <Resource label={t("Seviye")} value={`${c.level}`} sub={t("sınır {n}", { n: campaign.levelCap })} />
        <Resource label={t("Bonus tavanı")} value={`+${ucBonusCap(c.level)}`} sub={t("taşan bonus anlatıma")} />
        <Resource label={t("Yetenek puanı")} value={pts.unspent} tone={pts.unspent > 0 ? "accent" : undefined} sub={pts.zirve ? t("Zirve {n}", { n: Math.max(0, pts.zirveLeft) }) : t("K{tier} katmanı", { tier: c.level >= 10 ? 3 : c.level >= 5 ? 2 : 1 })} />
        <Resource label={t("Serbest stat")} value={c.freeStatPoints} tone={c.freeStatPoints > 0 ? "accent" : undefined} />
        <Resource label={t("Esin")} value={c.inspiration} tone={c.inspiration < 0 ? "danger" : undefined} sub={c.inspiration < 0 ? t("her zara {n}", { n: c.inspiration * 2 }) : t("1 Esin = yeniden at")} />
        <Resource
          label="Death Save"
          value={!campaign.deathSaveEnabled ? t("Kapalı") : ds.available ? t("Var") : t("Yok")}
          sub={ds.available && (ds.deaths || ds.saves) ? t("Ö {d} · K {s}", { d: ds.deaths, s: ds.saves }) : !ds.available && campaign.deathSaveEnabled ? t("yenileme {n} Esin", { n: ds.resets + 1 }) : undefined}
          tone={campaign.deathSaveEnabled && !ds.available ? "danger" : undefined}
        />
        <Resource label="Lumre" value={c.money.toLocaleString(intlLocale(loc))} />
        <Resource label={t("Yozlaşma")} value={`${c.corruption}/${UC_DECAY_MAX}`} tone={c.corruption >= 10 ? "danger" : c.corruption >= 4 ? "warn" : undefined} sub={ucDecayFloor(c.uc?.forks) ? t("taban Yoz {n}", { n: ucDecayFloor(c.uc?.forks) }) : undefined} />
      </div>

      <DecayBar value={c.corruption} floor={ucDecayFloor(c.uc?.forks)} />

      {campaign.deathSaveEnabled && !ds.available && canAct && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <span>{t("Death Save hakkını {n} Esin harcayarak yenileyebilirsin.", { n: ds.resets + 1 })}</span>
          <Button size="sm" disabled={busy || c.inspiration < ds.resets + 1} onClick={() => act(() => api(`/api/characters/${c.id}/death-save`, { body: {} }), t("Death Save yenilendi."))}>
            {t("Yenile")}
          </Button>
        </div>
      )}

      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "genel", label: t("Genel") },
          { key: "yetenekler", label: t("Yetenekler"), badge: (pts.unspent > 0 || openable.length > 0) && canAct ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
          { key: "yozlasma", label: t("Yozlaşma"), badge: fork ? <span className="h-2 w-2 rounded-full bg-lav" /> : undefined },
          { key: "beden", label: t("Beden") },
          { key: "envanter", label: t("Envanter & Notlar") },
          { key: "kayit", label: t("Kayıt") },
        ]}
      />

      {tab === "genel" && (
        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr]">
          <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg">{t("Statlar")}</h2>
              {c.freeStatPoints > 0 && canAct && <Badge tone="accent">{t("{n} serbest puan", { n: c.freeStatPoints })}</Badge>}
            </div>
            <div className="divide-y divide-line">
              {UC_STAT_KEYS.map((k) => {
                const v = u.stats[k];
                const sym = c.trees.some((t) => data.dals[t]?.stat === k);
                return (
                  <div key={k} className="flex items-center gap-3 py-2" data-testid={`stat-${k}`}>
                    <div className="min-w-0 flex-1">
                      <span className={cx("text-ink", sym && "text-accent")}>{UC_STAT_LABELS[k]}</span>
                      <span className="ml-2 text-xs text-muted">{ucTipFor("stats", k, loc)?.meaning}</span>
                    </div>
                    <div className="flex h-2 w-24 overflow-hidden rounded-full bg-surface2" aria-hidden>
                      <div className={cx("h-full", v < 0 ? "bg-danger" : "bg-accent/70")} style={{ width: `${Math.min(100, Math.abs(v) * 10)}%` }} />
                    </div>
                    <span className={cx("w-8 text-right font-mono text-lg", v < 0 && "text-danger")}>{v}</span>
                    {c.freeStatPoints > 0 && canAct && (
                      <Button size="sm" variant="outline" className="w-8 px-0" disabled={busy || v >= UC_STAT_MAX} onClick={() => act(() => api(`/api/uc/characters/${c.id}/spend-stat`, { body: { stat: k } }))} title={t("Serbest puan harca")}>
                        +
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              {t(
                "Zar: d20 + stat + bonuslar; sonucu GM işin zorluğuna göre değerlendirir. Bir kademe = ±3. Güçlü başarı: başarılı zarda d20'nin kendisi 15+. Stat dışı bonusların toplamı en fazla +{cap}; taşan kısım anlatıma döner. Cezaların tavanı yoktur.",
                { cap: ucBonusCap(c.level) },
              )}
            </p>
          </Card>
            <LanguagesCard characterId={c.id} languages={c.languages} list={UC_LANGUAGES} isGM={isGM} onSaved={() => router.refresh()} />
            <MetaCard c={c} canEdit={isGM || isOwner} act={act} faiths={faiths} />
            {(c.background || c.appearance || isGM || isOwner) && (
              <Card className="space-y-3 p-5">
                {(isGM || isOwner) && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="kicker">{t("Açıklama")}</p>
                    <ProfileEditor c={c} small />
                  </div>
                )}
                {!c.background && !c.appearance && <p className="text-sm text-muted">{t("Henüz geçmiş veya görünüş yazılmamış.")}</p>}
                {c.background && (
                  <div>
                    <p className="kicker mb-1">{t("Geçmiş")}</p>
                    <p className="whitespace-pre-line text-sm text-ink/90">{c.background}</p>
                  </div>
                )}
                {c.appearance && (
                  <div>
                    <p className="kicker mb-1">{t("Görünüş")}</p>
                    <p className="whitespace-pre-line text-sm text-ink/90">{c.appearance}</p>
                  </div>
                )}
              </Card>
            )}
            <SecretNotes c={c} canEdit={isGM || isOwner} act={act} />
          </div>
          <div className="space-y-6">
            <UcMechanicsCard
              key={`mech:${c.updatedAt}`}
              characterId={c.id}
              trees={c.trees}
              dals={data.dals}
              mechanics={mechanics}
              stats={u.stats}
              corruption={c.corruption}
              abilities={c.abilities}
              counters={c.uc?.counters ?? {}}
              notes={c.uc?.dalNotes ?? {}}
              canEdit={canAct}
              onSaved={() => router.refresh()}
            />
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg">{t("Perkler")}</h2>
                {(isGM || (isOwner && c.perkEditAllowed && c.status === "ACTIVE")) && (
                  <Button size="sm" variant="outline" onClick={() => setPerkOpen(true)}>
                    {t("Düzenle")}
                  </Button>
                )}
              </div>
              {c.perks.length === 0 ? (
                <p className="text-sm text-muted">{t("Perk yok.")}</p>
              ) : (
                <div className="space-y-2">
                  {c.perks.map((k) => {
                    const p = perks.find((x) => x.key === k);
                    return p ? <UcPerkCard key={k} perk={p} /> : null;
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "yetenekler" && (
        <AbilitiesTab c={c} u={u} data={data} abilities={abilities} canAct={canAct} busy={busy} act={act} mechanics={mechanics} isGM={isGM} onSaved={() => router.refresh()} />
      )}
      {tab === "yozlasma" && <DecayTab c={c} isGM={isGM} isOwner={isOwner} act={act} busy={busy} />}
      {tab === "beden" && <BodyTab c={c} isGM={isGM} act={act} />}
      {tab === "envanter" && <InventoryTab c={c} isGM={isGM} canEdit={canAct} act={act} moneyLabel="Lumre" gmPath={`/api/uc/characters/${c.id}/gm`} />}
      {tab === "kayit" && (
        <Card className="divide-y divide-line">
          {logs.length === 0 && <p className="p-5 text-sm text-muted">{t("Kayıt yok.")}</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="w-36 shrink-0 font-mono text-xs text-muted">{new Date(l.createdAt).toLocaleString(intlLocale(loc), { dateStyle: "short", timeStyle: "short" })}</span>
              <span className="min-w-0 flex-1">{tLoose(l.text)}</span>
              {l.actor && <span className="text-xs text-muted">{l.actor}</span>}
            </div>
          ))}
        </Card>
      )}

      {isGM && <GMEditor key={`gm:${c.updatedAt}:${gmOpen}`} open={gmOpen} onClose={() => setGmOpen(false)} c={c} u={u} data={data} act={act} />}
      {(isGM || isOwner) && <PerkEditor key={`perk:${c.updatedAt}:${perkOpen}`} open={perkOpen} onClose={() => setPerkOpen(false)} c={c} perks={perks} data={data} start={campaign.startPerkPoints} isGM={isGM} act={act} />}
    </div>
  );
}

// ------------------------------------------------------------------ yozlaşma
function DecayBar({ value, floor }: { value: number; floor: number }) {
  const t = useT();
  const ring = ucRingOf(value)?.name;
  return (
    <div className="mb-6">
      <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={UC_DECAY_MAX} aria-valuenow={value} aria-label={t("Yozlaşma")}>
        {Array.from({ length: UC_DECAY_MAX }).map((_, i) => {
          const lv = i + 1;
          const fork = lv % 3 === 0 && lv < 15;
          return (
            <div
              key={lv}
              title={`${lv}: ${t(UC_DECAY_EFFECTS[lv])}`}
              className={cx(
                "h-2 flex-1 rounded-sm",
                lv <= value ? (lv >= 13 ? "bg-danger" : lv >= 10 ? "bg-danger/80" : lv >= 7 ? "bg-lav" : lv >= 4 ? "bg-lav/70" : "bg-accent") : "bg-surface2",
                fork && "ring-1 ring-lav/60",
                lv <= floor && "outline outline-1 outline-offset-1 outline-lav/40",
              )}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        <MoonStar className="mr-1 inline h-3.5 w-3.5 text-lav" />
        {value === 0 ? t("Ruhun temiz.") : `${ring ? t(ring) : ""} · ${t(UC_DECAY_EFFECTS[value])}`}
      </p>
    </div>
  );
}

function ForkPrompt({ c, level, act, busy }: { c: Ch; level: UcForkLevel; act: Act; busy: boolean }) {
  const t = useT();
  const info = UC_FORK_INFO[level];
  return (
    <div className="mb-6 rounded-xl border border-lav/60 bg-lav/10 p-4" data-testid="fork-prompt">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-lav">{t(info.title).toUpperCase()}</p>
      <p className="mt-1 text-sm text-ink/90">{t("Yozlaşma {n}'e ulaştı: ruhun bir karar vermeli. Karar kalıcıdır; Yozlaşma bu çatalın altına inse bile etkisi sürer.", { n: level })}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => api(`/api/uc/characters/${c.id}/fork`, { body: { level, choice: "teslim" } }), t("Teslim seçildi."))}
          className="rounded-lg border border-danger/40 bg-surface/60 p-3 text-left text-sm transition hover:border-danger"
        >
          <span className="font-semibold text-danger">{t("Teslim")}</span> <span className="text-xs text-muted">{t("(taban Yoz {n})", { n: level === "3" ? 1 : level === "6" ? 4 : level === "9" ? 7 : 10 })}</span>
          <span className="mt-1 block text-ink/85">{t(info.teslim)}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => api(`/api/uc/characters/${c.id}/fork`, { body: { level, choice: "direnis" } }), t("Direniş seçildi."))}
          className="rounded-lg border border-accent/40 bg-surface/60 p-3 text-left text-sm transition hover:border-accent"
        >
          <span className="font-semibold text-accent">{t("Direniş")}</span> <span className="text-xs text-muted">{t("(taban bırakmaz)")}</span>
          <span className="mt-1 block text-ink/85">{t(info.direnis)}</span>
        </button>
      </div>
    </div>
  );
}

function DecayTab({ c, isGM, isOwner, act, busy }: { c: Ch; isGM: boolean; isOwner: boolean; act: Act; busy: boolean }) {
  const t = useT();
  const forks = c.uc?.forks ?? {};
  const counts = ucForkCounts(forks);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="p-5">
        <h2 className="mb-3 font-serif text-lg">{t("Çatallar")}</h2>
        <div className="space-y-3">
          {UC_FORK_LEVELS.map((l) => {
            const info = UC_FORK_INFO[l];
            const ch = forks[l];
            const reached = c.corruption >= Number(l);
            return (
              <div key={l} className={cx("rounded-lg border p-3 text-sm", ch === "teslim" ? "border-danger/40 bg-danger/[0.06]" : ch === "direnis" ? "border-accent/40 bg-accent/[0.06]" : "border-line")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">
                    {t("Yoz {n}", { n: l })} · {t(info.title).split("·")[1]?.trim()}
                  </span>
                  {ch ? <Badge tone={ch === "teslim" ? "danger" : "accent"}>{ch === "teslim" ? t("Teslim") : t("Direniş")}</Badge> : reached ? <Badge tone="warn">{t("Karar bekliyor")}</Badge> : <span className="text-xs text-muted">{t("ulaşılmadı")}</span>}
                </div>
                {ch && <p className="mt-1 text-ink/85">{t(ch === "teslim" ? info.teslim : info.direnis)}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          {t(
            "Teslim {s} · Direniş {r}. Yoz 15'te hesap kesilir: 3-4 Teslim karakteri sese verir, 3-4 Direniş son bir sahneyle ölüm, 2-2 sonu oyuncu ve GM birlikte belirler.",
            { s: counts.teslim, r: counts.direnis },
          )}
        </p>
        {(isGM || isOwner) && ucPendingFork(c.corruption, forks) && <p className="mt-2 text-xs text-lav">{t("Bekleyen çatal kararı sayfanın üstünde.")}</p>}
        {busy && null}
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-serif text-lg">{t("Yozlaşma tablosu")}</h2>
        <ol className="space-y-1 text-sm">
          {Array.from({ length: UC_DECAY_MAX }).map((_, i) => {
            const lv = i + 1;
            return (
              <li key={lv} className={cx("grid grid-cols-[40px_1fr] gap-2 rounded px-2 py-1", lv === c.corruption ? "bg-lav/15 text-ink" : lv < c.corruption ? "text-ink/80" : "text-muted")}>
                <span className="font-mono text-xs">{lv}</span>
                <span>{t(UC_DECAY_EFFECTS[lv])}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-muted">{t("Arınma (Blu Mana, yetenekler, iksirler) seans başına en fazla 2 azaltır. Oyun odasında GM Düşotu, mana geri tepmesi ve arınma zarlarını attırabilir.")}</p>
        {isGM && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => act(() => api(`/api/uc/characters/${c.id}/gm`, { method: "PATCH", body: { corruption: Math.max(0, c.corruption - 1) } }))}>
              {t("−1 Yozlaşma")}
            </Button>
            <Button size="sm" onClick={() => act(() => api(`/api/uc/characters/${c.id}/gm`, { method: "PATCH", body: { corruption: Math.min(UC_DECAY_MAX, c.corruption + 1) } }))}>
              {t("+1 Yozlaşma")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ kozmetik
function MetaCard({ c, canEdit, act, faiths }: { c: Ch; canEdit: boolean; act: Act; faiths?: UcFaith[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ race: c.nationality, house: c.alignment, faith: c.uc?.faith ?? "", food: c.uc?.food ?? "" });
  const [fk, setFk] = useState<string | null>(c.uc?.faithKey ?? null);
  const [fd, setFd] = useState(c.uc?.faithDetail ?? "");
  const hasFaiths = !!faiths?.length;
  const cur = hasFaiths ? ucResolveFaith(faiths, c.uc?.faithKey, c.uc?.faithDetail) : null;
  const pick = hasFaiths ? ucResolveFaith(faiths, fk, fd) : null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-lg">{t("Kimlik")}</h2>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("Düzenle")}
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">{t("Irk")}</dt>
        <dd>{t(c.nationality)}</dd>
        <dt className="text-muted">{t("Hane & unvan")}</dt>
        <dd>{c.alignment}</dd>
        <dt className="text-muted">{t("İnanç")}</dt>
        <dd>{cur?.label || c.uc?.faith || "—"}</dd>
        {cur && (
          <dd className="col-span-2 mt-1 rounded-lg border border-lav/35 bg-lav/[0.05] px-3 py-2 text-[13px]" data-testid="faith-effect">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-lav">{t("İnanç etkisi")}</span>
            {cur.option?.html && <UcHtml html={cur.option.html} />}
            {(!cur.option?.html || cur.faith.esoteric) && <UcHtml html={cur.faith.html} />}
          </dd>
        )}
        {hasFaiths && !cur && c.uc?.faith && <dd className="col-span-2 text-xs text-warn">{t("Bu inanç listedeki inançlardan biri değil; Düzenle'den listeden seç.")}</dd>}
        <dt className="text-muted">{t("Yiyecek")}</dt>
        <dd>{c.uc?.food || "—"}</dd>
      </dl>
      <Modal open={open} onClose={() => setOpen(false)} title={t("Kimlik")}>
        <div className="space-y-3">
          <Field label={t("Irk")}>
            <input className="input" value={v.race} maxLength={60} onChange={(e) => setV({ ...v, race: e.target.value })} />
          </Field>
          <Field label={t("Hane ve unvan")}>
            <input className="input" value={v.house} maxLength={80} onChange={(e) => setV({ ...v, house: e.target.value })} />
          </Field>
          {hasFaiths ? (
            <div>
              <p className="label">{t("İnanç")}</p>
              <p className="mb-2 text-xs text-muted">{t("İnanç değiştirmek (dönme ya da sapkınlık) GM onaylı bir RP gerektirir ve +1 Yozlaşma verir; Yozlaşmayı GM işler.")}</p>
              <div className="max-h-[50vh] overflow-y-auto pr-1">
                <UcFaithPicker
                  compact
                  faiths={faiths!}
                  value={fk}
                  detail={fd}
                  onChange={(k, d) => {
                    setFk(k);
                    setFd(d);
                  }}
                />
              </div>
            </div>
          ) : (
            <Field label={t("İnanç")}>
              <input className="input" value={v.faith} maxLength={80} onChange={(e) => setV({ ...v, faith: e.target.value })} />
            </Field>
          )}
          <Field label={t("Yiyecek")}>
            <input className="input" value={v.food} maxLength={120} onChange={(e) => setV({ ...v, food: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>{t("Vazgeç")}</Button>
            <Button
              variant="primary"
              disabled={v.race.trim().length < 2 || v.house.trim().length < 2 || (hasFaiths && !pick)}
              onClick={async () => {
                const body = hasFaiths ? { race: v.race, house: v.house, food: v.food, faithKey: fk ?? undefined, faithDetail: fd } : v;
                await act(() => api(`/api/uc/characters/${c.id}/meta`, { method: "PATCH", body }), t("Kaydedildi."));
                setOpen(false);
              }}
            >
              {t("Kaydet")}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ------------------------------------------------------------------ yetenekler
type AbProps = {
  c: Ch;
  u: UcCharLike;
  data: UcRules;
  abilities: UcAbility[];
  canAct: boolean;
  busy: boolean;
  act: Act;
  mechanics: Record<string, { title: string; html: string }>;
};

function AbilitiesTab(p: AbProps & { isGM: boolean; onSaved: () => void }) {
  const t = useT();
  const [sub, setSub] = useState<"mevcut" | "agaclar">("mevcut");
  const pts = ucPoints(p.u, p.data);
  const openable = p.canAct && (p.data.classes.find((x) => x.key === p.c.uc?.classKey)?.dals ?? []).some((k) => ucOpenDalProblems(p.u, k, p.data).length === 0);
  const tabs = (
    <SubTabs
      value={sub}
      onChange={setSub}
      tabs={[
        { key: "mevcut", label: t("Mevcut yetenekler") },
        { key: "agaclar", label: t("Dallar ve yetenekler"), badge: (pts.unspent > 0 || openable) && p.canAct ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
      ]}
    />
  );
  return (
    <div className="space-y-8">
      {tabs}
      {sub === "mevcut" ? (
        <>
          <OwnedAbilities {...p} />
          <CustomAbilitiesSection characterId={p.c.id} list={p.c.customAbilities ?? []} isGM={p.isGM} onSaved={p.onSaved} />
        </>
      ) : (
        <TiersView {...p} />
      )}
    </div>
  );
}

/** Mevcut yetenekler: seçilmiş dallardaki alınmış yetenekler alt alta; seçilmemiş katmanlar kilitli kart. */
function OwnedAbilities({ c, data, abilities, mechanics }: AbProps) {
  const t = useT();
  const cls = data.classes.find((x) => x.key === c.uc?.classKey);
  if (!cls) return <Card className="p-5 text-sm text-muted">{t("Ana sınıf seçilmemiş.")}</Card>;
  return (
    <div className="space-y-8" data-testid="owned-abilities">
      {([1, 2, 3] as const).map((tier) => {
        const chosen = c.trees.find((k) => data.dals[k]?.tier === tier);
        if (!chosen) {
          const options = cls.dals.filter((k) => data.dals[k].tier === tier).map((k) => data.dals[k].name);
          const open = c.level >= UC_TIER_OPEN[tier];
          return (
            <section key={tier} className="card flex flex-col gap-2 border-dashed p-5 opacity-80" data-testid="locked-tier">
              <p className="flex items-center gap-2 font-serif text-xl text-ink">
                <Lock className="h-5 w-5 text-muted" /> {t("K{tier}", { tier })} · {open ? t("dal seçilmedi") : t("Sv {lv}'te açılır", { lv: UC_TIER_OPEN[tier] })}
              </p>
              <p className="text-sm text-muted">
                {open ? t("Bu katmanın dalı henüz seçilmedi; Dallar ve yetenekler sekmesinden seçilir.") : t("Karakter seviye {lv} olunca bu katmandan bir dal seçilir.", { lv: UC_TIER_OPEN[tier] })}
              </p>
              <p className="text-xs text-muted">{t("Seçilebilecek dallar: {list}", { list: options.join(", ") })}</p>
            </section>
          );
        }
        const d = data.dals[chosen];
        const owned = d.abilities.filter((k) => (c.abilities[k] ?? 0) > 0);
        return (
          <section key={tier}>
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-3">
              <UcDalIcon dalKey={chosen} tier={tier} />
              <h2 className="font-serif text-2xl">
                {t("K{tier}", { tier })} · {d.name}
              </h2>
              <StatBadge stat={d.stat} />
              <span className="text-sm text-muted">{t("{n}/{total} yetenek", { n: owned.length, total: d.abilities.length })}</span>
              {mechanics[chosen] && <Badge tone="neutral">{t("Dal mekaniği · {title}", { title: mechanics[chosen].title })}</Badge>}
            </div>
            {owned.length === 0 ? (
              <p className="text-sm text-muted">{t("Bu dalda henüz alınmış yetenek yok.")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {owned.map((k) => {
                  const full = abilities.find((x) => x.key === k);
                  const lv = c.abilities[k] ?? 0;
                  return full ? (
                    <UcAbilityCard
                      key={k}
                      ability={full}
                      highlight="owned"
                      footer={
                        <Badge tone="accent">{t("Sv {lv}/{max}", { lv, max: full.maxLevel })}</Badge>
                      }
                    />
                  ) : null;
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TiersView({ c, u, data, abilities, canAct, busy, act, mechanics }: AbProps) {
  const loc = useLocale();
  const t = useT();
  const tLoose = useTLoose();
  const pts = ucPoints(u, data);
  const cls = data.classes.find((x) => x.key === c.uc?.classKey);
  if (!cls) return <Card className="p-5 text-sm text-muted">{t("Ana sınıf seçilmemiş. GM, GM düzenle penceresinden sınıf ve dal atayabilir.")}</Card>;
  return (
    <div className="space-y-10">
      <Card className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        {([1, 2, 3] as const).map((tier) => (
          <div key={tier}>
            <p className="text-[10px] uppercase tracking-wider text-muted">
              {t("K{tier} · Sv {lv}", { tier, lv: UC_TIER_OPEN[tier] })}
              {c.level < UC_TIER_OPEN[tier] && ` ${t("(kilitli)")}`}
            </p>
            <p className="font-mono text-lg">
              <span className={pts.available[tier] > 0 ? "text-accent" : "text-ink"}>{pts.available[tier]}</span>
              <span className="text-xs text-muted"> {t("boş · {spent}/{earned}", { spent: pts.spent[tier], earned: pts.earned[tier] })}</span>
            </p>
          </div>
        ))}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">{t("Zirve (Sv 15)")}</p>
          <p className="font-mono text-lg">{pts.zirve ? Math.max(0, pts.zirveLeft) : "—"}</p>
        </div>
        <p className="col-span-full text-xs text-muted">{t("Katman kilidi: bir katmanda kazanılan puan yalnızca o katmanda harcanır. Bir yeteneğin 3. seviyesi, katman açıldıktan en az 2 seviye sonra alınır.")}</p>
      </Card>
      {([1, 2, 3] as const).map((tier) => {
        const chosen = c.trees.find((k) => data.dals[k]?.tier === tier);
        const options = cls.dals.filter((k) => data.dals[k].tier === tier);
        if (!chosen) {
          const open = c.level >= UC_TIER_OPEN[tier];
          return (
            <section key={tier}>
              <div className="mb-4 flex items-center gap-3 border-b border-line pb-3">
                <h2 className="font-serif text-2xl">{t("Katman {n}", { n: tier })}</h2>
                {!open && (
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <Lock className="h-4 w-4" /> {t("Sv {lv}'te açılır", { lv: UC_TIER_OPEN[tier] })}
                  </span>
                )}
                {(c.uc?.pendingSymbol ?? 0) > 0 && open && <Badge tone="accent">{t("{n} sembol puanı dal seçimini bekliyor", { n: c.uc?.pendingSymbol })}</Badge>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {options.map((k) => {
                  const d = data.dals[k];
                  const problems = ucOpenDalProblems(u, k, data);
                  return (
                    <Card key={k} className="flex flex-col gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <UcDalIcon dalKey={k} tier={tier} />
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-lg text-ink">{d.name}</p>
                          <p className="text-xs italic text-muted">{ucTipFor("dals", k, loc)?.meaning}</p>
                        </div>
                        <StatBadge stat={d.stat} />
                      </div>
                      {d.identity && <p className="text-sm text-ink/85">{d.identity}</p>}
                      {mechanics[k] && (
                        <p className="w-fit rounded-md border border-lav/45 bg-lav/10 px-2 py-0.5 text-[11px] font-semibold text-lav">{t("Dal mekaniği · {title}", { title: mechanics[k].title })}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={`/umbracaelis/kurallar/siniflar/${cls.key}/${k}`} target="_blank" className="text-xs text-muted hover:text-ink">
                          {t("Dalı incele ↗")}
                        </a>
                        {canAct && open && (
                          <Button size="sm" variant="primary" disabled={busy || problems.length > 0} title={problems.map(tLoose).join(" · ")} onClick={() => act(() => api(`/api/uc/characters/${c.id}/open-dal`, { body: { dal: k } }), t("{name} seçildi.", { name: d.name }))}>
                            {t("Bu dalı seç")}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        }
        const d = data.dals[chosen];
        return (
          <section key={tier}>
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-3">
              <UcDalIcon dalKey={chosen} tier={tier} />
              <h2 className="font-serif text-2xl">
                {t("K{tier}", { tier })} · {d.name}
              </h2>
              <StatBadge stat={d.stat} />
              <span className="text-sm text-muted">{t("{n}/{total} yetenek", { n: d.abilities.filter((k) => c.abilities[k]).length, total: d.abilities.length })}</span>
            </div>
            {mechanics[chosen] && (
              <details className="card group mb-5 border-lav/40 p-0" data-testid={`mechanic-${chosen}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="block text-[11px] font-semibold uppercase tracking-widest text-lav">{t("Dal mekaniği")}</span>
                    <span className="font-serif text-base text-ink">{mechanics[chosen].title}</span>
                  </span>
                  <span className="text-sm text-muted group-open:hidden">{t("Göster · sayaçlar Genel sekmesinde")}</span>
                  <span className="hidden text-sm text-muted group-open:inline">{t("Gizle")}</span>
                </summary>
                <div className="border-t border-line px-5 py-4">
                  <UcHtml html={mechanics[chosen].html} />
                </div>
              </details>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {d.abilities.map((k) => {
                const full = abilities.find((x) => x.key === k);
                const lv = c.abilities[k] ?? 0;
                const st = ucLearnState(u, k, data);
                const footer = (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs">
                        {lv > 0 ? (
                          <Badge tone="accent">{t("Sv {lv}/{max}", { lv, max: data.abilities[k]?.maxLevel })}</Badge>
                        ) : (
                          <span className="text-muted">{t("Açılmadı")}</span>
                        )}
                      </span>
                      {canAct && st.state === "available" && (
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => act(() => api(`/api/uc/characters/${c.id}/learn`, { body: { ability: k } }), lv ? t("{name} seviye {n}", { name: data.abilities[k].name, n: st.nextLevel }) : t("{name} açıldı.", { name: data.abilities[k].name }))}>
                          {lv ? t("Sv {n}'e yükselt", { n: st.nextLevel }) : t("Aç (1 puan)")}
                          {st.usesZirve && ` · ${t("Zirve")}`}
                        </Button>
                      )}
                      {canAct && st.state === "locked" && <span className="w-full text-[11px] text-muted">{st.problems.map(tLoose).join(" · ")}</span>}
                    </div>
                  );
                  return (
                    <div key={k} className="grid" data-testid={`ability-${k}`}>
                      {full ? (
                        <UcAbilityCard ability={full} footer={footer} highlight={lv > 0 ? "owned" : st.state === "available" && canAct ? "available" : undefined} />
                      ) : (
                        <Card className="w-full p-4">
                          {data.abilities[k]?.name}
                          <div className="mt-3">{footer}</div>
                        </Card>
                      )}
                    </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ beden
function BodyTab({ c, isGM, act }: { c: Ch; isGM: boolean; act: Act }) {
  const t = useT();
  const body = normalizeBody(c.body);
  const [sel, setSel] = useState<BodyPartKey>("upper-torso");
  const part = body[sel];
  const patch = (b: Record<string, unknown>) => act(() => api(`/api/uc/characters/${c.id}/body`, { method: "PATCH", body: { part: sel, ...b } }));
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="flex flex-col items-center gap-4 p-5">
        <BodyDiagram body={body} selected={sel} onSelect={setSel} />
        <WoundLegend />
      </Card>
      <div className="space-y-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg">{t(bodyPartLabel(sel))}</h2>
            {woundPenalty(part) > 0 && <Badge tone="danger">{t("Zar cezası −{n}", { n: woundPenalty(part) })}</Badge>}
          </div>
          {isGM ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("Yara")}>
                <select className="input" value={part.wound} onChange={(e) => patch({ wound: e.target.value })}>
                  {WOUNDS.map((w) => (
                    <option key={w.key} value={w.key}>
                      {t(w.label)} {w.penalty ? `(−${w.penalty})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Sargı")}>
                <select className="input" value={part.bandage} disabled={part.wound === "saglam"} onChange={(e) => patch({ bandage: e.target.value })}>
                  {BANDAGES.map((b) => (
                    <option key={b.key} value={b.key}>
                      {t(b.label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Not (zırh, protez…)")}>
                <input className="input" defaultValue={part.note} maxLength={200} key={sel} onBlur={(e) => e.target.value !== part.note && patch({ note: e.target.value })} />
              </Field>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted">{t("Yara")}</dt>
              <dd>{t(WOUNDS.find((w) => w.key === part.wound)?.label ?? "")}</dd>
              <dt className="text-muted">{t("Sargı")}</dt>
              <dd>{t(BANDAGES.find((b) => b.key === part.bandage)?.label ?? "")}</dd>
              {part.note && (
                <>
                  <dt className="text-muted">{t("Not")}</dt>
                  <dd>{part.note}</dd>
                </>
              )}
            </dl>
          )}
          <p className="mt-3 text-xs text-muted">{t("Umbra Caelis'te augment yoktur. Kopan uzvun yerine takılan protez uzvu Kullanılamaz durumuna getirir; GM nota yazar.")}</p>
        </Card>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b border-line bg-surface2/60 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("Uzuv")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Durum")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Ceza")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Not")}</th>
              </tr>
            </thead>
            <tbody>
              {BODY_PARTS.map((p) => {
                const s = body[p.key];
                const pen = woundPenalty(s);
                return (
                  <tr key={p.key} onClick={() => setSel(p.key)} className={cx("cursor-pointer border-b border-line/50 last:border-0 hover:bg-surface2/50", sel === p.key && "bg-accent/5")}>
                    <td className="px-4 py-2">{t(p.label)}</td>
                    <td className="px-4 py-2">
                      {t(WOUNDS.find((w) => w.key === s.wound)?.label ?? "")}
                      {s.bandage !== "yok" && <span className="text-xs text-muted"> · {t(BANDAGES.find((b) => b.key === s.bandage)?.label ?? "")}</span>}
                    </td>
                    <td className={cx("px-4 py-2 font-mono", pen > 0 && "text-danger")}>{pen ? `−${pen}` : "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted">{s.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ GM düzenleyici
function GMEditor({ open, onClose, c, u, data, act }: { open: boolean; onClose: () => void; c: Ch; u: UcCharLike; data: UcRules; act: Act }) {
  const t = useT();
  const [v, setV] = useState({
    level: c.level,
    freeStatPoints: c.freeStatPoints,
    corruption: c.corruption,
    inspiration: c.inspiration,
    status: c.status,
    stats: { ...u.stats },
    deathAvailable: c.deathSave.available,
    perkEditAllowed: c.perkEditAllowed,
    forks: { ...(c.uc?.forks ?? {}) } as Record<string, string | undefined>,
    reason: "",
  });
  const num = (k: "level" | "freeStatPoints" | "corruption" | "inspiration", label: string, min: number, max: number) => (
    <Field label={label}>
      <input type="number" className="input" min={min} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
    </Field>
  );
  const forksChanged = UC_FORK_LEVELS.some((l) => (v.forks[l] ?? null) !== (c.uc?.forks?.[l] ?? null));
  return (
    <Modal open={open} onClose={onClose} title={t("GM düzenle")} wide>
      <div className="space-y-5">
        <p className="text-sm text-muted">{t("Her değişiklik karakterin kaydına yazılır. Yetenek ve dal düzeltmelerinde kural kitabındaki önkoşullar uygulanmaz.")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {num("level", t("Seviye"), 0, 15)}
          {num("freeStatPoints", t("Serbest stat"), 0, 50)}
          {num("corruption", t("Yozlaşma"), 0, UC_DECAY_MAX)}
          {num("inspiration", t("Esin"), -20, 50)}
        </div>
        <div className="flex flex-wrap gap-4">
          <Field label={t("Durum")}>
            <select className="input" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Ch["status"] })}>
              <option value="ACTIVE">{t("Aktif")}</option>
              <option value="PENDING">{t("Onay bekliyor")}</option>
              <option value="REJECTED">{t("Reddedildi")}</option>
              <option value="DEAD">{t("Öldü")}</option>
              <option value="RETIRED">{t("Emekli")}</option>
            </select>
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.deathAvailable} onChange={(e) => setV({ ...v, deathAvailable: e.target.checked })} className="h-4 w-4 accent-[rgb(190,172,242)]" />
            {t("Death Save hakkı var")}
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.perkEditAllowed} onChange={(e) => setV({ ...v, perkEditAllowed: e.target.checked })} className="h-4 w-4 accent-[rgb(190,172,242)]" />
            {t("Oyuncu perklerini düzenleyebilir")}
          </label>
        </div>
        <div>
          <span className="label">{t("Statlar")}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {UC_STAT_KEYS.map((k) => (
              <label key={k} className="block">
                <span className="text-[11px] text-muted">{UC_STAT_LABELS[k]}</span>
                <input type="number" className="input py-1.5" min={-20} max={10} value={v.stats[k]} onChange={(e) => setV({ ...v, stats: { ...v.stats, [k]: Number(e.target.value) } })} />
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="label">{t("Yozlaşma çatalları")}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {UC_FORK_LEVELS.map((l) => (
              <label key={l} className="block">
                <span className="text-[11px] text-muted">{t(UC_FORK_INFO[l].title)}</span>
                <select className="input py-1.5" value={v.forks[l] ?? ""} onChange={(e) => setV({ ...v, forks: { ...v.forks, [l]: e.target.value || undefined } })}>
                  <option value="">{t("Karar yok")}</option>
                  <option value="teslim">{t("Teslim")}</option>
                  <option value="direnis">{t("Direniş")}</option>
                </select>
              </label>
            ))}
          </div>
        </div>
        <Field label={t("Gerekçe (kayda yazılır)")}>
          <input className="input" maxLength={200} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder={t("ör. Düşotu, seans ödülü")} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await act(
                () =>
                  api(`/api/uc/characters/${c.id}/gm`, {
                    method: "PATCH",
                    body: {
                      ...(v.level !== c.level && { level: v.level }),
                      ...(v.freeStatPoints !== c.freeStatPoints && { freeStatPoints: v.freeStatPoints }),
                      ...(v.corruption !== c.corruption && { corruption: v.corruption }),
                      ...(v.inspiration !== c.inspiration && { inspiration: v.inspiration }),
                      ...(v.status !== c.status && { status: v.status }),
                      ...(UC_STAT_KEYS.some((k) => v.stats[k] !== u.stats[k]) && { stats: v.stats }),
                      ...(v.deathAvailable !== c.deathSave.available && { deathSave: { available: v.deathAvailable, resets: c.deathSave.resets } }),
                      ...(v.perkEditAllowed !== c.perkEditAllowed && { perkEditAllowed: v.perkEditAllowed }),
                      ...(forksChanged && { forks: Object.fromEntries(UC_FORK_LEVELS.map((l) => [l, v.forks[l] ?? null])) }),
                      reason: v.reason || undefined,
                    },
                  }),
                t("Karakter güncellendi."),
              );
              onClose();
            }}
          >
            {t("Kaydet")}
          </Button>
        </div>
        <details className="rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-muted">{t("Sınıf / dal / yetenek / perk düzeltmesi")}</summary>
          <GMLists c={c} data={data} act={act} />
        </details>
      </div>
    </Modal>
  );
}

function GMLists({ c, data, act }: { c: Ch; data: UcRules; act: Act }) {
  const t = useT();
  const [classKey, setClassKey] = useState(c.uc?.classKey ?? "");
  const [trees, setTrees] = useState<string[]>(c.trees);
  const [abilities, setAbilities] = useState<Record<string, number>>(c.abilities);
  const [perks, setPerks] = useState<string[]>(c.perks);
  const cls = data.classes.find((x) => x.key === classKey);
  return (
    <div className="mt-3 space-y-4">
      <Field label={t("Ana sınıf")}>
        <select className="input" value={classKey} onChange={(e) => (setClassKey(e.target.value), setTrees([]))}>
          <option value="">—</option>
          {data.classes.map((x) => (
            <option key={x.key} value={x.key}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      {cls && (
        <div>
          <span className="label">{t("Dallar (katman başına bir)")}</span>
          <div className="flex flex-wrap gap-2">
            {cls.dals.map((k) => (
              <label key={k} className={cx("chip cursor-pointer", trees.includes(k) && "border-accent text-accent")}>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={trees.includes(k)}
                  onChange={(e) => setTrees(e.target.checked ? [...trees.filter((x) => data.dals[x]?.tier !== data.dals[k].tier), k] : trees.filter((x) => x !== k))}
                />
                {t("K{tier}", { tier: data.dals[k].tier })} · {data.dals[k].name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className="label">{t("Yetenek seviyeleri")}</span>
        <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {trees.flatMap((tk) =>
            (data.dals[tk]?.abilities ?? []).map((k) => {
              const a = data.abilities[k];
              return (
                <label key={k} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-surface2">
                  <span className="truncate">{a.name}</span>
                  <select className="input h-7 w-16 py-0 text-xs" value={abilities[k] ?? 0} onChange={(e) => setAbilities({ ...abilities, [k]: Number(e.target.value) })}>
                    {Array.from({ length: a.maxLevel + 1 }).map((_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }),
          )}
        </div>
      </div>
      <div>
        <span className="label">{t("Perkler")}</span>
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {data.perks.map((p) => (
            <label key={p.key} className={cx("chip cursor-pointer", perks.includes(p.key) && "border-accent text-accent")}>
              <input type="checkbox" className="hidden" checked={perks.includes(p.key)} onChange={(e) => setPerks(e.target.checked ? [...perks, p.key] : perks.filter((x) => x !== p.key))} />
              {p.kind === "positive" ? "−" : "+"}
              {p.points} {p.name}
            </label>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => act(() => api(`/api/uc/characters/${c.id}/gm`, { method: "PATCH", body: { ...(classKey && { classKey }), trees, abilities, perks } }), t("Listeler güncellendi."))}
      >
        {t("Listeleri kaydet")}
      </Button>
    </div>
  );
}

function PerkEditor({ open, onClose, c, perks: perkList, data, start, isGM, act }: { open: boolean; onClose: () => void; c: Ch; perks: UcPerk[]; data: UcRules; start: number; isGM: boolean; act: Act }) {
  const t = useT();
  const tLoose = useTLoose();
  const [perks, setPerks] = useState<string[]>(c.perks);
  const [q, setQ] = useState("");
  const before = ucPerkBudget(c.perks, start, data);
  const budget = ucPerkBudget(perks, start, data);
  const delta = budget.convertible - before.convertible;
  const changed = JSON.stringify([...perks].sort()) !== JSON.stringify([...c.perks].sort());
  const n = q.toLocaleLowerCase("tr-TR");
  const shown = perkList.filter((p) => !n || p.searchText.includes(n));
  return (
    <Modal open={open} onClose={onClose} title={t("Perkleri düzenle")} wide>
      <div className="space-y-4">
        {!isGM && <p className="text-sm text-muted">{t("GM izni tek seferliktir: kaydedince izin kapanır.")}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {t("Kalan")} <strong className={cx("font-mono", budget.left < 0 && "text-danger")}>{budget.left}</strong> {t("→ stat {n}", { n: budget.convertible })}
          </span>
          <input className="input max-w-xs" placeholder={t("Perk ara…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {budget.problems.length > 0 && <p className="text-sm text-danger">{budget.problems.map(tLoose).join(" · ")}</p>}
        <div className="grid max-h-[50vh] gap-2 overflow-y-auto md:grid-cols-2">
          {shown.map((p) => {
            const on = perks.includes(p.key);
            return (
              <UcPerkCard
                key={p.key}
                perk={p}
                selected={on}
                action={
                  <Button size="sm" variant={on ? "primary" : "secondary"} onClick={() => setPerks(on ? perks.filter((x) => x !== p.key) : [...perks, p.key])}>
                    {on ? t("Seçildi") : t("Seç")}
                  </Button>
                }
              />
            );
          })}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface pt-3 text-sm">
          <span className={cx(delta < 0 ? "text-danger" : delta > 0 ? "text-ok" : "text-muted")}>
            {delta > 0
              ? t("+{n} serbest stat puanı kazanırsın.", { n: delta })
              : delta < 0
                ? isGM
                  ? t("Bu seçim {n} stat puanını geri alır (GM olarak kaydedebilirsin).", { n: -delta })
                  : t("Bu seçim {n} stat puanını geri alır; kaydedilemez.", { n: -delta })
                : t("Stat puanı değişmez.")}
          </span>
          <span className="flex gap-2">
            <Button onClick={onClose}>{t("Vazgeç")}</Button>
            <Button
              variant="primary"
              disabled={!changed || budget.problems.length > 0 || (delta < 0 && !isGM)}
              onClick={async () => {
                await act(() => api(`/api/uc/characters/${c.id}/perks`, { body: { perks } }), t("Perkler güncellendi."));
                onClose();
              }}
            >
              {t("Kaydet")}
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
