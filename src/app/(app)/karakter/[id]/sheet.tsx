"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyDiagram, WoundLegend } from "@/components/body-diagram";
import { AbilityTree } from "@/components/content/ability-tree";
import { AbilityCard, Html, PerkCard } from "@/components/content/cards";
import { PerkPicker } from "@/components/content/perk-picker";
import { HeartPulse, Skull, Sparkles } from "lucide-react";
import { Modal, SubTabs, Tabs, useAction, useHashTab } from "@/components/interactive";
import { CustomAbilitiesSection } from "@/components/character/custom-abilities";
import { Lock } from "lucide-react";
import { CorruptionEffects } from "@/components/corruption";
import { Portrait, PortraitEditor } from "@/components/portrait";
import { DeleteCharacter, InventoryTab, ProfileEditor, Resource, SecretNotes } from "@/components/character/shared";
import { LanguagesCard } from "@/components/character/languages";
import { SHZ_LANGUAGES } from "@/lib/languages";
import { Badge, Button, Card, Field, StatusBadge, cx } from "@/components/ui";
import type { Character, InventoryItem } from "@/db/schema";
import { api } from "@/lib/client";
import { useLocale, useT, useTLoose } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import {
  BANDAGES,
  BODY_PARTS,
  CORRUPTION_EFFECTS,
  CORRUPTION_MAX,
  STAT_HINTS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_MAX,
  WOUNDS,
  bodyPartLabel,
  type BodyPartKey,
} from "@/lib/shz/constants";
import type { RulesData } from "@/lib/shz/content";
import type { Ability } from "@/lib/shz/content-types";
import { MAX_TREES } from "@/lib/shz/constants";
import { activeSynergies, bodyPenalty, isMors, kriegsversehrtLimbs, perkPoints, canOpenTree, effectiveStats, installedAugments, learnState, normalizeBody, perkBudget, refundPlan, woundPenalty, type CharLike } from "@/lib/shz/rules";

type Ch = Omit<Character, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
interface Log {
  id: string;
  kind: string;
  text: string;
  createdAt: string;
  actor: string | null;
}
const TABS = ["genel", "yetenekler", "beden", "envanter", "kayit"] as const;
type Tab = (typeof TABS)[number];

export function Sheet({
  character: c,
  campaign,
  ownerName,
  isGM,
  isOwner,
  data,
  logs,
}: {
  character: Ch;
  campaign: { id: string; name: string; deathSaveEnabled: boolean; levelCap: number; startPerkPoints: number };
  ownerName: string;
  isGM: boolean;
  isOwner: boolean;
  data: RulesData;
  logs: Log[];
}) {
  const t = useT();
  const tLoose = useTLoose();
  const loc = useLocale();
  const router = useRouter();
  const { busy, run } = useAction();
  const [tab, setTab] = useHashTab<Tab>(TABS, "genel");
  const [gmOpen, setGmOpen] = useState(false);
  const [perkOpen, setPerkOpen] = useState(false);
  const canAct = isGM || (isOwner && c.status === "ACTIVE");
  const ch: CharLike = c;
  const eff = useMemo(() => effectiveStats(ch, data), [ch, data]);
  const ds = c.deathSave;

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
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
            <Link href={`/kampanya/${campaign.id}`} className="hover:underline">
              {campaign.name}
            </Link>
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl sm:text-4xl">
            {c.name} <StatusBadge status={c.status} />
          </h1>
          <p className="mt-2 text-sm text-muted">
            {ownerName} · {t("{n} yaş", { n: c.age })} · {c.nationality} · {c.alignment}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.trees.map((tk, i) => (
              <Badge key={tk} tone="accent">
                {data.trees.find((x) => x.key === tk)?.name ?? tk}
                {i === 0 && ` · ${t("başlangıç")}`}
              </Badge>
            ))}
          </div>
        </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link href={`/kampanya/${campaign.id}/oda`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-onAccent hover:bg-accent/90">
            {t("Oyun odası")}
          </Link>
          {isGM && (
            <Button variant="outline" onClick={() => setGmOpen(true)}>
              {t("GM düzenle")}
            </Button>
          )}
          {(isGM || isOwner) && <ProfileEditor c={c} />}
          {(isGM || isOwner) && <DeleteCharacter id={c.id} name={c.name} afterHref={`/kampanya/${campaign.id}`} />}
        </div>
      </header>

      {c.status === "PENDING" && (
        <div className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm">{t("Karakter GM onayı bekliyor. Onaylanınca puan harcayabilir ve oyun odasında zar atabilirsin.")}</div>
      )}
      {c.status === "DEAD" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-danger" /> <strong>{t("{name} öldü.", { name: c.name })}</strong> {t("Ölü karakterler zar atamaz ve puan harcayamaz.")}
          </span>
          {isGM && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api(`/api/characters/${c.id}/gm`, { method: "PATCH", body: { revive: true } }), t("{name} diriltildi.", { name: c.name }))}>
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
      {c.status === "REJECTED" && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {t("GM bu karakteri reddetti")}
          {c.reviewNote ? `: ${c.reviewNote}` : "."} {t("Kampanya sayfasından yeni bir karakter oluşturabilirsin.")}
        </div>
      )}

      {/* Kaynak şeridi */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        <Resource label={t("Seviye")} value={`${c.level}`} sub={t("sınır {n}", { n: campaign.levelCap })} />
        <Resource label={t("Yetenek puanı")} value={c.abilityPoints} tone={c.abilityPoints > 0 ? "accent" : undefined} />
        <Resource label={t("Serbest stat")} value={c.freeStatPoints} tone={c.freeStatPoints > 0 ? "accent" : undefined} />
        <Resource label="Inspiration" value={c.inspiration} tone={c.inspiration < 0 ? "danger" : undefined} sub={c.inspiration < 0 ? t("her zara {n}", { n: c.inspiration * 2 }) : undefined} />
        <Resource
          label="Death Save"
          value={!campaign.deathSaveEnabled ? t("Kapalı") : ds.available ? t("Var") : t("Yok")}
          sub={ds.available && (ds.deaths || ds.saves) ? t("Ö {d} · K {s}", { d: ds.deaths, s: ds.saves }) : !ds.available && campaign.deathSaveEnabled ? t("yenileme {n} insp.", { n: ds.resets + 1 }) : undefined}
          tone={campaign.deathSaveEnabled && !ds.available ? "danger" : undefined}
        />
        <Resource label="Reichsmark" value={c.money.toLocaleString(intlLocale(loc))} />
        <Resource label="Corruption" value={`${c.corruption}/13`} tone={c.corruption >= 7 ? "danger" : c.corruption >= 4 ? "warn" : undefined} sub={c.corruptionLocked ? t("7 altına inemez") : undefined} />
      </div>

      <CorruptionBar value={c.corruption} mors={isMors(c)} />
      {isMors(c) && <MorsNotice />}

      {campaign.deathSaveEnabled && !ds.available && canAct && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <span>{t("Death Save hakkını {n} Inspiration harcayarak yenileyebilirsin.", { n: ds.resets + 1 })}</span>
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
          { key: "yetenekler", label: t("Yetenekler"), badge: c.abilityPoints > 0 && canAct ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
          { key: "beden", label: t("Beden & Augment") },
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
              {STAT_KEYS.map((k) => {
                const e = eff[k];
                const isTree = data.trees.find((t) => t.key === c.trees[0])?.stat === k;
                return (
                  <div key={k} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className={cx("text-ink", isTree && "text-accent")}>{STAT_LABELS[k]}</span>
                      <span className="ml-2 text-xs text-muted">{t(STAT_HINTS[k])}</span>
                      {e.parts.length > 0 && (
                        <span className="block text-[11px] text-muted">
                          {t("taban {n}", { n: e.base })}
                          {e.parts.map((p) => ` · ${tLoose(p.label)} ${p.value > 0 ? "+" : ""}${p.value}`).join("")}
                          {e.capped && ` · ${t("sınırlandı")}`}
                        </span>
                      )}
                    </div>
                    <div className="flex h-2 w-24 overflow-hidden rounded-full bg-surface2" aria-hidden>
                      <div className={cx("h-full", e.value < 0 ? "bg-danger" : "bg-accent/70")} style={{ width: `${Math.min(100, Math.abs(e.value) * 10)}%` }} />
                    </div>
                    <span className={cx("w-8 text-right font-mono text-lg", e.value < 0 && "text-danger")}>{e.value}</span>
                    {c.freeStatPoints > 0 && canAct && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-8 px-0"
                        disabled={busy || c.stats[k] >= STAT_MAX}
                        onClick={() => act(() => api(`/api/characters/${c.id}/spend-stat`, { body: { stat: k } }))}
                        title={t("Serbest puan harca")}
                      >
                        +
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
            <LanguagesCard characterId={c.id} languages={c.languages} list={SHZ_LANGUAGES} isGM={isGM} onSaved={() => router.refresh()} />
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
                    const p = data.perks.find((x) => x.key === k);
                    const limbs = k === "kriegsversehrt" ? kriegsversehrtLimbs(c.body) : 0;
                    return p ? <PerkCard key={k} perk={p} pointsLabel={limbs ? t("{points} · {n} uzuv", { points: perkPoints(p, { limbs }), n: limbs }) : undefined} /> : null;
                  })}
                </div>
              )}
            </Card>
            <AugmentsCard c={c} data={data} />
          </div>
        </div>
      )}

      {tab === "yetenekler" && <AbilitiesTab c={c} data={data} canAct={canAct} busy={busy} act={act} isGM={isGM} onSaved={() => router.refresh()} />}
      {tab === "beden" && <BodyTab c={c} data={data} isGM={isGM} act={act} />}
      {tab === "envanter" && <InventoryTab c={c} isGM={isGM} canEdit={canAct} act={act} />}
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

      {isGM && <GMEditor key={`gm:${c.updatedAt}:${gmOpen}`} open={gmOpen} onClose={() => setGmOpen(false)} c={c} data={data} act={act} />}
      {(isGM || isOwner) && <PerkEditor key={`perk:${c.updatedAt}:${perkOpen}`} open={perkOpen} onClose={() => setPerkOpen(false)} c={c} data={data} start={campaign.startPerkPoints} isGM={isGM} act={act} />}
    </div>
  );
}

/** Mors sınıf kurallarının kâğıttaki özeti. */
function MorsNotice() {
  const t = useT();
  return (
    <div className="mb-6 rounded-xl border border-lav/45 bg-lav/[0.06] px-4 py-3 text-sm" data-testid="mors-notice">
      <p className="mb-1 font-mono text-xs font-semibold tracking-[0.2em] text-lav">MORS</p>
      <ul className="grid gap-x-6 gap-y-1 text-ink/90 sm:grid-cols-2">
        <li>{t("Kukla beden: yara cezaları uygulanmaz (Kopuk uzuv hariç).")}</li>
        <li>{t("Ağır beden: Korp, Krach, Agil ve Aim zarlarında eşik 2 kademe yükselir.")}</li>
        <li>{t("Yenilenme: seans başına 1 kez, uzun dinlenmede bir uzuv tamamen iyileşir; Kopuk uzuv yeniden büyür.")}</li>
        <li>{t("Corruption'ın olumsuz etkileri işlemez; 7 tabanı ve 13 sınırı geçerli. Pervitin etkisiz.")}</li>
      </ul>
    </div>
  );
}

export function CorruptionBar({ value, mors }: { value: number; mors?: boolean }) {
  const t = useT();
  if (value === 0)
    return (
      <div className="mb-6">
        <div
          className="relative flex h-7 items-center justify-center overflow-hidden rounded-md border border-ok/40 bg-ok/[0.07]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={CORRUPTION_MAX}
          aria-valuenow={0}
          aria-label="Corruption"
        >
          <span className="corr-clean-beam pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-ok/25 to-transparent" aria-hidden />
          <span lang="en" className="relative font-mono text-xs font-semibold tracking-[0.3em] text-ok">
            CORRUPTION 0
          </span>
        </div>
      </div>
    );
  return (
    <div className="mb-6">
      <div className="flex gap-1" role="meter" aria-valuemin={0} aria-valuemax={CORRUPTION_MAX} aria-valuenow={value} aria-label="Corruption">
        {Array.from({ length: CORRUPTION_MAX + 1 }).map((_, i) => (
          <div
            key={i}
            title={`${i}: ${t(CORRUPTION_EFFECTS[i])}`}
            className={cx("h-2 flex-1 rounded-sm", i === 0 ? "hidden" : i <= value ? (i >= 9 ? "bg-danger" : i >= 5 ? "bg-warn" : "bg-accent") : "bg-surface2", i === 7 && "ring-1 ring-danger/50")}
          />
        ))}
      </div>
      <CorruptionEffects value={value} className="mt-3" mors={mors} />
    </div>
  );
}

// ------------------------------------------------------------------ yetenekler
function AbilitiesTab({
  c,
  data,
  canAct,
  busy,
  act,
  isGM,
  onSaved,
}: {
  c: Ch;
  data: RulesData;
  canAct: boolean;
  busy: boolean;
  act: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
  isGM: boolean;
  onSaved: () => void;
}) {
  const t = useT();
  const [sub, setSub] = useState<"mevcut" | "agaclar">("mevcut");
  const tabs = (
    <SubTabs
      value={sub}
      onChange={setSub}
      tabs={[
        { key: "mevcut", label: t("Mevcut yetenekler") },
        { key: "agaclar", label: t("Yetenek ağaçları"), badge: canAct && c.abilityPoints > 0 ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
      ]}
    />
  );
  if (sub === "mevcut")
    return (
      <div className="space-y-8">
        {tabs}
        <OwnedAbilities c={c} data={data} canAct={canAct} />
        <CustomAbilitiesSection characterId={c.id} list={c.customAbilities ?? []} isGM={isGM} onSaved={onSaved} />
      </div>
    );
  return (
    <div className="space-y-8">
      {tabs}
      <TreesView c={c} data={data} canAct={canAct} busy={busy} act={act} />
    </div>
  );
}

/** Mevcut yetenekler: açılmış ağaçlardaki alınmış yetenekler alt alta; açılmamış ağaç yuvası kilitli kart olarak. */
function OwnedAbilities({ c, data, canAct }: { c: Ch; data: RulesData; canAct: boolean }) {
  const t = useT();
  const closed = data.trees.filter((x) => !c.trees.includes(x.key));
  const slots = Array.from({ length: MAX_TREES }, (_, i) => c.trees[i] ?? null);
  return (
    <div className="space-y-8" data-testid="owned-abilities">
      {slots.map((tk, i) => {
        const tree = tk ? data.trees.find((x) => x.key === tk) : null;
        if (!tree)
          return (
            <section key={`slot-${i}`} className="card flex flex-col gap-2 border-dashed p-5 opacity-80" data-testid="locked-tree">
              <p className="flex items-center gap-2 font-serif text-xl text-ink">
                <Lock className="h-5 w-5 text-muted" /> {t("{n}. ekspertiz ağacı · kilitli", { n: i + 1 })}
              </p>
              <p className="text-sm text-muted">{canAct ? t("1 yetenek puanı harcanarak açılır; Yetenek ağaçları sekmesinden açabilirsin.") : t("1 yetenek puanı harcanarak açılır.")}</p>
              <p className="text-xs text-muted">{t("Seçilebilecek ağaçlar: {list}", { list: closed.map((x) => x.name).join(", ") })}</p>
            </section>
          );
        const owned = tree.abilities.filter((k) => (c.abilities[k] ?? 0) > 0);
        return (
          <section key={tk}>
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-line pb-3">
              <h2 className="font-serif text-2xl">{tree.name}</h2>
              <Badge tone="accent">{STAT_LABELS[tree.stat]}</Badge>
              <span className="text-sm text-muted">
                {t("{n}/{total} yetenek", { n: owned.length, total: tree.abilities.length })}
                {i === 0 ? ` · ${t("başlangıç ağacı")}` : ""}
              </span>
            </div>
            {owned.length === 0 ? (
              <p className="text-sm text-muted">{t("Bu ağaçta henüz alınmış yetenek yok.")}</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {owned.map((k) => {
                  const a = data.abilities[k];
                  const syn = activeSynergies(c, a);
                  return (
                    <AbilityCard
                      key={k}
                      ability={a}
                      level={c.abilities[k]}
                      highlight="owned"
                      prereqName={a.prerequisite ? data.abilities[a.prerequisite]?.name : null}
                      footer={syn.length > 0 ? <p className="text-[11px] text-accent">{t("Sinerji aktif: {list}", { list: syn.map((x) => data.abilities[x]?.name).join(", ") })}</p> : undefined}
                    />
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TreesView({ c, data, canAct, busy, act }: { c: Ch; data: RulesData; canAct: boolean; busy: boolean; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const [treeModal, setTreeModal] = useState(false);
  const closed = data.trees.filter((x) => !c.trees.includes(x.key));
  const openable = canAct ? closed.filter((x) => canOpenTree(c, x.key, data).length === 0) : [];
  const openTree = (key: string, name: string) => act(() => api(`/api/characters/${c.id}/open-tree`, { body: { tree: key } }), t("{name} açıldı.", { name })).then(() => setTreeModal(false));
  return (
    <div className="space-y-10">
      {openable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok/50 bg-ok/10 px-4 py-3">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ok">{t("YENİ AĞAÇ AÇILABİLİR")}</p>
            <p className="text-sm text-ink/90">{t("1 yetenek puanı harcayarak ikinci ekspertiz ağacını açabilirsin.")}</p>
          </div>
          <Button variant="primary" onClick={() => setTreeModal(true)}>
            {t("Ağaç aç")}
          </Button>
        </div>
      )}
      {canAct && c.abilityPoints > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <strong>{c.abilityPoints}</strong> {t("yetenek puanın var. Yeşil kenarlı yetenekleri alabilirsin; kilitli olanların altında eksik şart yazar.")}
        </div>
      )}
      {c.trees.map((tk) => {
        const tree = data.trees.find((x) => x.key === tk);
        if (!tree) return null;
        return (
          <section key={tk}>
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-3">
              <h2 className="font-serif text-2xl">{tree.name}</h2>
              <Badge tone="accent">{STAT_LABELS[tree.stat]}</Badge>
              <span className="text-sm text-muted">
                {t("{n}/{total} yetenek", { n: tree.abilities.filter((k) => c.abilities[k]).length, total: tree.abilities.length })}
              </span>
            </div>
            <AbilityTree tree={tree} abilities={data.abilities} owned={c.abilities} render={(a) => <AbilityTile key={a.key} a={a} c={c} data={data} canAct={canAct} busy={busy} act={act} />} />
          </section>
        );
      })}
      {closed.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">{t("Diğer ağaçlar")}</h2>
            <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setShowAll(!showAll)}>
              {showAll ? t("Gizle") : t("Göster")}
            </button>
          </div>
          {showAll && <TreeChoices c={c} data={data} trees={closed} canAct={canAct} busy={busy} onOpen={openTree} />}
        </section>
      )}
      <Modal open={treeModal} onClose={() => setTreeModal(false)} title={t("Yeni ekspertiz ağacı aç")} wide>
        <p className="mb-4 text-sm text-muted">{t("En fazla 2 ağaç açılabilir. Açmak 1 yetenek puanı harcar; ağacın yetenekleri için yine puan gerekir.")}</p>
        <TreeChoices c={c} data={data} trees={closed} canAct={canAct} busy={busy} onOpen={openTree} />
      </Modal>
    </div>
  );
}

function TreeChoices({ c, data, trees, canAct, busy, onOpen }: { c: Ch; data: RulesData; trees: RulesData["trees"]; canAct: boolean; busy: boolean; onOpen: (key: string, name: string) => void }) {
  const t = useT();
  const tLoose = useTLoose();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {trees.map((tree) => {
        const problems = canOpenTree(c, tree.key, data).map(tLoose);
        return (
          <Card key={tree.key} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg">{tree.name}</span>
              <Badge>{STAT_LABELS[tree.stat]}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link href={`/kurallar/yetenekler/${tree.key}`} target="_blank" className="text-xs text-muted hover:text-ink">
                {t("Ağacı incele ↗")}
              </Link>
              {canAct && (
                <Button size="sm" variant={problems.length ? "outline" : "primary"} disabled={busy || problems.length > 0} title={problems.join(" · ")} onClick={() => onOpen(tree.key, tree.name)}>
                  {t("1 puanla aç")}
                </Button>
              )}
            </div>
            {canAct && problems.length > 0 && <p className="mt-2 text-[11px] text-muted">{problems.join(" · ")}</p>}
          </Card>
        );
      })}
    </div>
  );
}

function AbilityTile({ a, c, data, canAct, busy, act }: { a: Ability; c: Ch; data: RulesData; canAct: boolean; busy: boolean; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const tLoose = useTLoose();
  const [open, setOpen] = useState(false);
  const lv = c.abilities[a.key] ?? 0;
  const st = learnState(c, a.key, data);
  const syn = lv ? activeSynergies(c, a) : [];
  const highlight = lv ? "owned" : st.state === "available" ? "available" : "locked";
  return (
    <AbilityCard
      ability={a}
      level={lv || undefined}
      compact={!open}
      highlight={canAct || lv ? highlight : undefined}
      prereqName={a.prerequisite ? data.abilities[a.prerequisite]?.name : null}
      prereqMissing={!!a.prerequisite && !lv && !(c.abilities[a.prerequisite] > 0)}
      footer={
        <div className="space-y-2">
          {syn.length > 0 && <p className="text-[11px] text-accent">{t("Sinerji aktif: {list}", { list: syn.map((k) => data.abilities[k]?.name).join(", ") })}</p>}
          {st.state === "locked" && canAct && <p className="text-xs text-muted">{st.problems.map(tLoose).join(" · ")}</p>}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="rounded-md border border-line px-2.5 py-1 text-xs text-ink/80 hover:border-accent hover:text-ink" onClick={() => setOpen(!open)}>
              {open ? t("Kısalt") : t("Ayrıntıları göster")}
            </button>
            {canAct && st.state === "available" && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => act(() => api(`/api/characters/${c.id}/learn`, { body: { ability: a.key } }), lv ? t("{name} seviye {n}", { name: a.name, n: st.nextLevel }) : t("{name} açıldı.", { name: a.name }))}>
                {lv ? t("Sv {n}'e yükselt", { n: st.nextLevel }) : t("Aç (1 puan)")}
              </Button>
            )}
          </div>
        </div>
      }
    />
  );
}

// ------------------------------------------------------------------ beden
function BodyTab({ c, data, isGM, act }: { c: Ch; data: RulesData; isGM: boolean; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const body = normalizeBody(c.body);
  const [sel, setSel] = useState<BodyPartKey>("upper-torso");
  const part = body[sel];
  const augs = installedAugments(c.body, data);
  const fits = data.augments.filter((a) => a.slots.includes(sel));
  const patch = (b: Record<string, unknown>) => act(() => api(`/api/characters/${c.id}/body`, { method: "PATCH", body: { part: sel, ...b } }));
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
            {bodyPenalty(c, part) > 0 && <Badge tone="danger">{t("Zar cezası −{n}", { n: bodyPenalty(c, part) })}</Badge>}
            {isMors(c) && part.wound !== "saglam" && bodyPenalty(c, part) === 0 && <Badge tone="accent">{t("Mors: ceza yok")}</Badge>}
          </div>
          {isGM ? (
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Augment">
                <select className="input" value={part.augment ?? ""} onChange={(e) => patch({ augment: e.target.value || null })}>
                  <option value="">{t("Yok")}</option>
                  {fits.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.tier} · {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Not")}>
                <input className="input" defaultValue={part.note} maxLength={200} key={sel} onBlur={(e) => e.target.value !== part.note && patch({ note: e.target.value })} />
              </Field>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted">{t("Yara")}</dt>
              <dd>{t(WOUNDS.find((w) => w.key === part.wound)?.label ?? "")}</dd>
              <dt className="text-muted">{t("Sargı")}</dt>
              <dd>{t(BANDAGES.find((b) => b.key === part.bandage)?.label ?? "")}</dd>
              <dt className="text-muted">Augment</dt>
              <dd>{data.augments.find((a) => a.key === part.augment)?.name ?? t("Yok")}</dd>
              {part.note && (
                <>
                  <dt className="text-muted">{t("Not")}</dt>
                  <dd>{part.note}</dd>
                </>
              )}
            </dl>
          )}
        </Card>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead className="border-b border-line bg-surface2/60 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("Uzuv")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Durum")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Ceza")}</th>
                <th className="px-4 py-2.5 font-medium">Augment</th>
              </tr>
            </thead>
            <tbody>
              {BODY_PARTS.map((p) => {
                const s = body[p.key];
                const pen = bodyPenalty(c, s);
                return (
                  <tr key={p.key} onClick={() => setSel(p.key)} className={cx("cursor-pointer border-b border-line/50 last:border-0 hover:bg-surface2/50", sel === p.key && "bg-accent/5")}>
                    <td className="px-4 py-2">{t(p.label)}</td>
                    <td className="px-4 py-2">
                      {t(WOUNDS.find((w) => w.key === s.wound)?.label ?? "")}
                      {s.bandage !== "yok" && <span className="text-xs text-muted"> · {t(BANDAGES.find((b) => b.key === s.bandage)?.label ?? "")}</span>}
                    </td>
                    <td className={cx("px-4 py-2 font-mono", pen > 0 && "text-danger")}>{pen ? `−${pen}` : "—"}</td>
                    <td className="px-4 py-2 text-accent">{data.augments.find((a) => a.key === s.augment)?.name ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        {augs.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {augs.map(({ part: p, augment }) => (
              <Card key={p} className="p-4">
                <p className="kicker mb-1">{t(bodyPartLabel(p))}</p>
                <p className="font-serif text-lg">{augment.name}</p>
                <Html html={augment.usageHtml} className="mt-2 text-sm" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ GM düzenleyici
function GMEditor({ open, onClose, c, data, act }: { open: boolean; onClose: () => void; c: Ch; data: RulesData; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [v, setV] = useState({
    level: c.level,
    abilityPoints: c.abilityPoints,
    freeStatPoints: c.freeStatPoints,
    corruption: c.corruption,
    corruptionLocked: c.corruptionLocked,
    inspiration: c.inspiration,
    status: c.status,
    stats: { ...c.stats },
    deathAvailable: c.deathSave.available,
    perkEditAllowed: c.perkEditAllowed,
    treeGrants: c.treeGrants ?? [],
    reason: "",
  });
  const restricted = data.trees.filter((x) => x.restricted);
  const t = useT();
  const [refund, setRefund] = useState(false);
  const num = (k: "level" | "abilityPoints" | "freeStatPoints" | "corruption" | "inspiration", min: number, max: number) => (
    <Field lang={k === "corruption" || k === "inspiration" ? "en" : undefined} label={t({ level: "Seviye", abilityPoints: "Yetenek puanı", freeStatPoints: "Serbest stat", corruption: "Corruption", inspiration: "Inspiration" }[k])}>
      <input type="number" className="input" min={min} max={max} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
    </Field>
  );
  return (
    <Modal open={open} onClose={onClose} title={t("GM düzenle")} wide>
      <div className="space-y-5">
        <p className="text-sm text-muted">{t("Her değişiklik karakterin kaydına yazılır. Yetenek ve ağaç düzeltmeleri için kural kitabındaki önkoşullar uygulanmaz.")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {num("level", 0, 15)}
          {num("abilityPoints", 0, 50)}
          {num("freeStatPoints", 0, 50)}
          {num("corruption", 0, 13)}
          {num("inspiration", -20, 50)}
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
            <input type="checkbox" checked={v.corruptionLocked} onChange={(e) => setV({ ...v, corruptionLocked: e.target.checked })} className="h-4 w-4 accent-[rgb(186,168,240)]" />
            {t("Corruption 7 kilidi")}
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.deathAvailable} onChange={(e) => setV({ ...v, deathAvailable: e.target.checked })} className="h-4 w-4 accent-[rgb(186,168,240)]" />
            {t("Death Save hakkı var")}
          </label>
          <label className="mt-6 flex items-center gap-2 text-sm" title={t("Oyuncu perklerini bir kez yeniden seçebilir")}>
            <input type="checkbox" checked={v.perkEditAllowed} onChange={(e) => setV({ ...v, perkEditAllowed: e.target.checked })} className="h-4 w-4 accent-[rgb(186,168,240)]" />
            {t("Oyuncu perklerini düzenleyebilir")}
          </label>
          {restricted.map((tr) => (
            <label key={tr.key} className="mt-6 flex items-center gap-2 text-sm" title={t("Kısıtlı ağaç: oyuncu yalnızca GM izniyle, 2. ağaç olarak açabilir")} data-testid={`grant-${tr.key}`}>
              <input
                type="checkbox"
                checked={v.treeGrants.includes(tr.key)}
                onChange={(e) => setV({ ...v, treeGrants: e.target.checked ? [...v.treeGrants, tr.key] : v.treeGrants.filter((x) => x !== tr.key) })}
                className="h-4 w-4 accent-[rgb(186,168,240)]"
              />
              {t("{tree} açılabilir", { tree: tr.name })}
            </label>
          ))}
        </div>
        <div>
          <span className="label">{t("Ham statlar (perk, augment ve corruption hariç; eksi değer girilebilir)")}</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STAT_KEYS.map((k) => (
              <label key={k} className="block">
                <span className="text-[11px] text-muted">{STAT_LABELS[k]}</span>
                <input
                  type="number"
                  className="input py-1.5"
                  min={-20}
                  max={10}
                  value={v.stats[k]}
                  onChange={(e) => setV({ ...v, stats: { ...v.stats, [k]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
        </div>
        <Field label={t("Gerekçe (kayda yazılır)")}>
          <input className="input" maxLength={200} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder={t("ör. Pervitin kullanımı, oturum ödülü")} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await act(
                () =>
                  api(`/api/characters/${c.id}/gm`, {
                    method: "PATCH",
                    body: {
                      ...(v.level !== c.level && { level: v.level }),
                      ...(v.abilityPoints !== c.abilityPoints && { abilityPoints: v.abilityPoints }),
                      ...(v.freeStatPoints !== c.freeStatPoints && { freeStatPoints: v.freeStatPoints }),
                      ...((v.corruption !== c.corruption || v.corruptionLocked !== c.corruptionLocked) && { corruption: v.corruption, corruptionLocked: v.corruptionLocked }),
                      ...(v.inspiration !== c.inspiration && { inspiration: v.inspiration }),
                      ...(v.status !== c.status && { status: v.status }),
                      ...(STAT_KEYS.some((k) => v.stats[k] !== c.stats[k]) && { stats: v.stats }),
                      ...(v.deathAvailable !== c.deathSave.available && { deathSave: { available: v.deathAvailable, resets: c.deathSave.resets } }),
                      ...(v.perkEditAllowed !== c.perkEditAllowed && { perkEditAllowed: v.perkEditAllowed }),
                      ...(v.treeGrants.join() !== (c.treeGrants ?? []).join() && { treeGrants: v.treeGrants }),
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/40 bg-warn/[0.07] p-3 text-sm">
          <span>{t("Tüm stat ve yetenek puanlarını oyuncuya iade et; oyuncu yeniden dağıtsın.")}</span>
          <Button size="sm" variant="outline" onClick={() => setRefund(true)}>
            {t("Puanları iade et…")}
          </Button>
        </div>
        <RefundModal open={refund} onClose={() => setRefund(false)} c={c} data={data} act={act} />
        <details className="rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-muted">{t("Yetenek / ağaç / perk düzeltmesi")}</summary>
          <GMLists c={c} data={data} act={act} />
        </details>
      </div>
    </Modal>
  );
}

function GMLists({ c, data, act }: { c: Ch; data: RulesData; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const [trees, setTrees] = useState<string[]>(c.trees);
  const [abilities, setAbilities] = useState<Record<string, number>>(c.abilities);
  const [perks, setPerks] = useState<string[]>(c.perks);
  return (
    <div className="mt-3 space-y-4">
      <div>
        <span className="label">{t("Ağaçlar (en fazla 2, ilki başlangıç)")}</span>
        <div className="flex flex-wrap gap-2">
          {data.trees.map((tree) => (
            <label key={tree.key} className="chip cursor-pointer">
              <input
                type="checkbox"
                checked={trees.includes(tree.key)}
                onChange={(e) => setTrees(e.target.checked ? [...trees, tree.key].slice(0, 2) : trees.filter((x) => x !== tree.key))}
              />
              {tree.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <span className="label">{t("Yetenek seviyeleri")}</span>
        <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {trees.flatMap((tk) =>
            (data.trees.find((x) => x.key === tk)?.abilities ?? []).map((k) => {
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
      <Button size="sm" variant="outline" onClick={() => act(() => api(`/api/characters/${c.id}/gm`, { method: "PATCH", body: { trees, abilities, perks } }), t("Listeler güncellendi."))}>
        {t("Listeleri kaydet")}
      </Button>
    </div>
  );
}

function RefundModal({ open, onClose, c, data, act }: { open: boolean; onClose: () => void; c: Ch; data: RulesData; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const plan = refundPlan(c, data);
  const [stats, setStats] = useState(true);
  const [abilities, setAbilities] = useState(true);
  return (
    <Modal open={open} onClose={onClose} title={t("Puanları iade et")}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">{t("Seviye değişmez. Başlangıç değerleri (Klang {n}, ağaç stat'ı ve seviye artışları, ağaç bonusu) korunur; geri kalan her şey puana döner.", { n: 2 })}</p>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input type="checkbox" checked={stats} onChange={(e) => setStats(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(186,168,240)]" />
          <span>
            <strong className="text-ink">{plan.statPoints}</strong> {t("stat puanı serbest puana dönsün")}
            <span className="mt-1 block text-xs text-muted">
              {STAT_KEYS.filter((k) => c.stats[k] !== plan.stats[k])
                .map((k) => `${STAT_LABELS[k]} ${c.stats[k]} → ${plan.stats[k]}`)
                .join(" · ") || t("Dağıtılmış puan yok.")}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-line p-3">
          <input type="checkbox" checked={abilities} onChange={(e) => setAbilities(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(186,168,240)]" />
          <span>
            <strong className="text-ink">{plan.abilityPoints}</strong> {t("yetenek puanı geri dönsün")}
            <span className="mt-1 block text-xs text-muted">{c.trees.length > 1 ? t("Tüm yetenekler sıfırlanır, ikinci ağaç kapanır. Başlangıç ağacı kalır.") : t("Tüm yetenekler sıfırlanır. Başlangıç ağacı kalır.")}</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="danger"
            disabled={(!stats || !plan.statPoints) && (!abilities || !plan.abilityPoints)}
            onClick={async () => {
              await act(() => api(`/api/characters/${c.id}/gm`, { method: "PATCH", body: { refund: { stats, abilities } } }), t("Puanlar iade edildi."));
              onClose();
            }}
          >
            {t("İade et")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PerkEditor({ open, onClose, c, data, start, isGM, act }: { open: boolean; onClose: () => void; c: Ch; data: RulesData; start: number; isGM: boolean; act: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const t = useT();
  const [perks, setPerks] = useState<string[]>(c.perks);
  const opts = { limbs: kriegsversehrtLimbs(c.body) };
  const before = perkBudget(c.perks, start, data, opts);
  const budget = perkBudget(perks, start, data, opts);
  const delta = budget.convertible - before.convertible;
  const changed = JSON.stringify([...perks].sort()) !== JSON.stringify([...c.perks].sort());
  return (
    <Modal open={open} onClose={onClose} title={t("Perkleri düzenle")} wide>
      <div className="space-y-4">
        {!isGM && <p className="text-sm text-muted">{t("GM izni tek seferliktir: kaydedince izin kapanır.")}</p>}
        <PerkPicker perks={data.perks} selected={perks} onToggle={(k) => setPerks((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} budget={budget} />
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
                await act(() => api(`/api/characters/${c.id}/perks`, { body: { perks } }), t("Perkler güncellendi."));
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

// ------------------------------------------------------------------ augmentler (genel)
function AugmentsCard({ c, data }: { c: Ch; data: RulesData }) {
  const t = useT();
  const augs = installedAugments(c.body, data);
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-serif text-lg">{t("Takılı augmentler")}</h2>
      {augs.length === 0 ? (
        <p className="text-sm text-muted">{t("Takılı augment yok.")}</p>
      ) : (
        <div className="space-y-3">
          {augs.map(({ part, augment: a }) => (
            <div key={part} className="rounded-lg border border-line bg-surface2/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-base text-ink">{a.name}</span>
                {a.tier && <Badge tone={a.tier === "T3" ? "danger" : a.tier === "T2" ? "warn" : "accent"}>{a.tier}</Badge>}
                <span className="text-xs text-muted">{t(bodyPartLabel(part))}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {a.mods.map((m) => (
                  <span key={m.stat} className={cx("rounded px-1.5 py-0.5 font-mono text-[11px]", m.value > 0 ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}>
                    {m.value > 0 ? "+" : "−"}
                    {Math.abs(m.value)} {STAT_LABELS[m.stat]}
                  </span>
                ))}
              </div>
              {a.usageHtml && <Html html={a.usageHtml} className="mt-2 text-sm" />}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

