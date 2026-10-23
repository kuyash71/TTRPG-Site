"use client";
import { CheckSquare, Dices, Eye, HeartPulse, MessageCircleOff, MoonStar, Skull, Square, Trash2, UserPlus, UserRound, UserX } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppLink, useGo } from "@/components/app-link";
import { io, type Socket } from "socket.io-client";
import { BodyDiagram } from "@/components/body-diagram";
import { CorruptionEffects } from "@/components/corruption";
import { AbilityCard, PerkCard } from "@/components/content/cards";
import { TreeIcon } from "@/components/content/icons";
import { Modal, Tabs, useToast } from "@/components/interactive";
import { Portrait } from "@/components/portrait";
import { Badge, Button, cx } from "@/components/ui";
import type { Character, RollDetail } from "@/db/schema";
import { BASE_PATH } from "@/lib/base";
import { api } from "@/lib/client";
import { BODY_PARTS, CORRUPTION_EFFECTS, STAT_KEYS, STAT_LABELS, THRESHOLDS, type BodyPartKey, type StatKey } from "@/lib/shz/constants";
import type { RulesData } from "@/lib/shz/content";
import { PHYSICAL_STATS, bodyPenalty, checkModifiers, effectiveStats, installedAugments, isMors, morsThreshold, normalizeBody, outcomeLabel, woundPenalty } from "@/lib/shz/rules";
import { campaignHref, characterHref, createCharHref, panelHref, type Sys } from "@/lib/links";
import { UC_STAT_KEYS, UC_STAT_LABELS, type UcStatKey } from "@/lib/uc/constants";
import { UC_DECAY_EFFECTS, UC_DECAY_MAX, UC_DECAY_MODES, ucBonusCap, ucCheckParts, ucNormalizeStats, type UcDecayMode, type UcRules } from "@/lib/uc/rules";
import { useLocale, useT, useTLoose } from "@/i18n/client";
import { intlLocale, type Locale, type TFn } from "@/i18n/core";

/** Odanın oyun sistemi ve masa ayarları (Schwarzesonne / Umbra Caelis, fiziksel zar). */
interface RoomSys {
  system: Sys;
  uc: UcRules | null;
  physical: boolean;
  deathSaveEnabled: boolean;
}
const SysCtx = createContext<RoomSys>({ system: "SHZ", uc: null, physical: false, deathSaveEnabled: true });
const useSys = () => useContext(SysCtx);
const pointName = (sys: Sys) => (sys === "UC" ? "Esin" : "Inspiration");
const decayName = (sys: Sys) => (sys === "UC" ? "Yozlaşma" : "Corruption");
const statKeysOf = (sys: Sys): readonly string[] => (sys === "UC" ? UC_STAT_KEYS : STAT_KEYS);
/** Sunucudan Türkçe gelen zar parçası etiketini gösterim diline çevirir ("Sol Kol yarası", "Durum + Yoz zar"). */
function partLabelOf(t: TFn, tl: (s: string) => string, label: string) {
  const m = /^(.+) yarası$/.exec(label);
  if (m) return t("{part} yarası", { part: t(m[1]) });
  return label
    .split(" + ")
    .map((x) => tl(x))
    .join(" + ");
}
/** Sistem mesajı: "GM zar istedi: …" içindeki parçalar da ayrı ayrı çevrilir. */
function systemTextOf(tl: (s: string) => string, t: TFn, s: string) {
  const m = /^GM zar istedi: ([\s\S]*?)(?: \(([^()]*)\))? → ([\s\S]*)$/.exec(s);
  if (m) {
    const bits = m[2]
      ? m[2]
          .split(", ")
          .map((b) => {
            const d = /^durum (.+)$/.exec(b);
            return d ? t("durum {mod}", { mod: d[1] }) : tl(b);
          })
          .join(", ")
      : "";
    return bits ? t("GM zar istedi: {label} ({bits}) → {names}", { label: tl(m[1]), bits, names: m[3] }) : t("GM zar istedi: {label} → {names}", { label: tl(m[1]), names: m[3] });
  }
  return tl(s);
}
/** Zar ek notu birden çok cümleden oluşabilir (taşan bonus + büyü geri tepmesi): her biri ayrı çevrilir. */
function extraText(tl: (s: string) => string, s: string) {
  return s
    .split(/ (?=Büyü zarında Nat1)/)
    .map((x) => tl(x))
    .join(" ");
}
function statLabelOf(sys: Sys, k: string | null) {
  if (!k) return "";
  return sys === "UC" ? (UC_STAT_LABELS[k as UcStatKey] ?? k) : (STAT_LABELS[k as StatKey] ?? k);
}
/** Umbra Caelis karakterinin zar önizlemesi (sunucu aynı fonksiyonla hesaplar). */
function ucPreview(c: FullChar, p: { stat: string; part: string; modifier: number; magic: boolean; decay: boolean }) {
  return ucCheckParts(
    { stats: ucNormalizeStats(c.stats as unknown as Record<string, number>), body: c.body, level: c.level, corruption: c.corruption, inspiration: c.inspiration, uc: c.uc ?? {} },
    { stat: (p.stat || null) as UcStatKey | null, part: (p.part || null) as BodyPartKey | null, modifier: p.modifier, magic: p.magic, decay: p.decay },
  );
}

type FullChar = Omit<Character, "createdAt" | "updatedAt">;
type PublicChar = Pick<FullChar, "id" | "userId" | "name" | "status" | "level" | "nationality" | "alignment" | "age" | "appearance" | "trees" | "languages" | "portraitVersion">;
type Entry = { view: "gm" | "owner"; character: FullChar } | { view: "public"; character: PublicChar };

interface Msg {
  id: string;
  campaignId: string;
  userId: string | null;
  characterId: string | null;
  recipientId: string | null;
  channel: "IC" | "OOC" | "WHISPER" | "SYSTEM";
  content: string;
  createdAt: string;
  userName: string | null;
  characterName: string | null;
}
interface RollV {
  id: string;
  campaignId?: string;
  userId: string | null;
  characterId: string | null;
  kind: string;
  label: string;
  dice: number[];
  detail: RollDetail;
  hidden: boolean;
  rerolled: boolean;
  createdAt: string;
  userName: string | null;
  characterName: string | null;
}
interface RollReq {
  id: string;
  kind: "check" | "death" | "pervitin" | "decay";
  characters: { id: string; name: string; userId: string | null }[];
  stat: string | null;
  threshold: string | null;
  thresholdValue: number | null;
  thresholdLabel: string | null;
  modifier: number;
  label: string;
  blackMagic: boolean;
  magic?: boolean;
  decay?: boolean;
  decayMode?: UcDecayMode | null;
  hidden: boolean;
  playerPart: boolean;
}
type FeedItem = { t: "m"; at: string; m: Msg } | { t: "r"; at: string; r: RollV };
type Ack = { ok: true; data?: unknown } | { ok: false; error: string };
type Member = { id: string; displayName: string; chatMuted: boolean; rollMuted: boolean; role: "PLAYER" | "SPECTATOR" };
type Emit = (ev: string, p: unknown) => Promise<Ack>;

export function Room({
  campaign,
  me,
  isGM,
  isSpectator,
  gm,
  members,
  initialChars,
  data,
  ucData = null,
  needsCharacter,
}: {
  campaign: { id: string; name: string; deathSaveEnabled: boolean; physicalDice: boolean; system: Sys };
  me: { id: string; displayName: string };
  isGM: boolean;
  isSpectator: boolean;
  gm: { id: string; displayName: string };
  members: Member[];
  initialChars: Entry[];
  data: RulesData;
  /** Umbra Caelis odası için sade kural verisi. */
  ucData?: UcRules | null;
  needsCharacter: boolean;
}) {
  const go = useGo();
  const t = useT();
  const loc = useLocale();
  const [settings, setSettings] = useState({ physicalDice: campaign.physicalDice, deathSaveEnabled: campaign.deathSaveEnabled });
  const sys: RoomSys = useMemo(
    () => ({ system: campaign.system, uc: ucData, physical: settings.physicalDice, deathSaveEnabled: settings.deathSaveEnabled }),
    [campaign.system, ucData, settings],
  );
  const [memberList, setMemberList] = useState<Member[]>(members);
  const myMute = memberList.find((m) => m.id === me.id) ?? { chatMuted: false, rollMuted: false, role: isSpectator ? "SPECTATOR" : "PLAYER" };
  // İzleyici: sahneye yazamaz, zar atamaz, karakter oluşturamaz (rol değişikliği anında yansır).
  const spectator = !isGM && myMute.role === "SPECTATOR";
  const [askChar, setAskChar] = useState(false);
  useEffect(() => {
    if (!needsCharacter) return;
    try {
      if (sessionStorage.getItem(`shz:askChar:${campaign.id}`)) return;
    } catch {
      /* depolama kapalı */
    }
    setAskChar(true);
  }, [needsCharacter, campaign.id]);
  const closeAsk = () => {
    setAskChar(false);
    try {
      sessionStorage.setItem(`shz:askChar:${campaign.id}`, "1");
    } catch {
      /* yok say */
    }
  };
  const toast = useToast();
  const [viewing, setViewing] = useState<string | null>(null);

  // Başka sayfalara geçince "Oyun odasına dön" düğmesi için hatırla.
  useEffect(() => {
    try {
      sessionStorage.setItem("shz:lastRoom", JSON.stringify({ id: campaign.id, name: campaign.name, system: campaign.system }));
    } catch {
      /* depolama kapalı */
    }
  }, [campaign.id, campaign.name, campaign.system]);
  const sock = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [chars, setChars] = useState<Entry[]>(initialChars);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [rolls, setRolls] = useState<RollV[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [requests, setRequests] = useState<RollReq[]>([]);
  const [mobileTab, setMobileTab] = useState<"parti" | "akis" | "zar">("akis");
  const [popups, setPopups] = useState<RollV[]>([]);
  const [scrollKey, setScrollKey] = useState(0);
  const [rollKey, setRollKey] = useState(0);
  const loaded = useRef(false);

  const join = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const s = sock.current;
        if (!s?.connected) return resolve(false);
        s.timeout(10_000).emit("join", { campaignId: campaign.id }, (err: Error | null, r: Ack) => {
          if (err || !r.ok) {
            if (r && !r.ok) toast(r.error, "error");
            return resolve(false);
          }
          const d = r.data as { online: string[]; messages: Msg[]; rolls: RollV[]; requests: RollReq[] };
          setOnline(d.online);
          setMsgs(d.messages);
          setRolls(d.rolls);
          setRequests(d.requests ?? []);
          loaded.current = true;
          resolve(true);
        });
      }),
    [campaign.id, toast],
  );

  const emit = useCallback<Emit>(
    async (ev, payload) => {
      const once = () =>
        new Promise<Ack>((resolve) => {
          const s = sock.current;
          if (!s?.connected) return resolve({ ok: false, error: t("Bağlantı yok. Birkaç saniye içinde yeniden bağlanılacak.") });
          s.timeout(10_000).emit(ev, payload, (err: Error | null, r: Ack) => resolve(err ? { ok: false, error: t("Sunucu yanıt vermedi.") } : r));
        });
      let r = await once();
      // Bağlantı koptuysa ya da oda üyeliği düştüyse bir kez yeniden katılıp tekrar dene.
      if (!r.ok && (r.error === t("Bağlantı yok. Birkaç saniye içinde yeniden bağlanılacak.") || r.error === t("Önce odaya katıl.") || /odaya katıl|Bağlantı yok/.test(r.error))) {
        sock.current?.connect();
        await new Promise((res) => setTimeout(res, 600));
        if (await join()) r = await once();
      }
      return r;
    },
    [join, t],
  );

  const refreshChar = useCallback(async (characterId: string) => {
    try {
      const r = await api<Entry>(`/api/characters/${characterId}`);
      setChars((list) => {
        const i = list.findIndex((e) => e.character.id === characterId);
        if (i < 0) return [...list, r];
        const n = [...list];
        n[i] = r;
        return n;
      });
    } catch {
      /* erişim yoksa yok say */
    }
  }, []);

  const pushPopup = useCallback((r: RollV) => {
    setPopups((x) => [...x.filter((y) => y.id !== r.id).slice(-2), r]);
    setTimeout(() => setPopups((x) => x.filter((y) => y.id !== r.id)), r.userId ? 5200 : 4000);
  }, []);

  useEffect(() => {
    const s = io({ path: `${BASE_PATH}/socket.io`, withCredentials: true, transports: ["websocket", "polling"], auth: { loc } });
    sock.current = s;
    s.on("connect", () => {
      setConnected(true);
      void join();
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));
    s.on("message", (m: Msg) => m.campaignId === campaign.id && setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x.slice(-299), m])));
    s.on("roll", (r: RollV) => {
      if (r.campaignId !== campaign.id) return;
      setRolls((x) => (x.some((y) => y.id === r.id) ? x : [...x.slice(-199), r]));
      if (loaded.current) pushPopup(r);
      if (r.userId === me.id) setRollKey((k) => k + 1);
    });
    s.on("roll:deleted", ({ id }: { id: string }) => setRolls((x) => x.filter((r) => r.id !== id)));
    s.on("rolls:cleared", () => setRolls([]));
    s.on("mute:changed", (p: { userId: string; chatMuted: boolean; rollMuted: boolean; role?: Member["role"] }) =>
      setMemberList((list) => list.map((m) => (m.id === p.userId ? { ...m, chatMuted: p.chatMuted, rollMuted: p.rollMuted, role: p.role ?? m.role } : m))),
    );
    s.on("feed:deleted", (p: { messageIds: string[]; rollIds: string[] }) => {
      const mi = new Set(p.messageIds);
      const ri = new Set(p.rollIds);
      if (mi.size) setMsgs((x) => x.filter((m) => !mi.has(m.id)));
      if (ri.size) setRolls((x) => x.filter((r) => !ri.has(r.id)));
    });
    s.on("messages:cleared", (p: { scope: "IC" | "OOC" | "WHISPER" | "ALL"; peerId: string | null }) =>
      setMsgs((x) =>
        x.filter((m) => {
          if (p.scope === "ALL") return false;
          if (p.scope === "IC") return m.channel !== "IC" && m.channel !== "SYSTEM";
          if (p.scope === "OOC") return m.channel !== "OOC";
          return !(m.channel === "WHISPER" && (!p.peerId || m.userId === p.peerId || m.recipientId === p.peerId));
        }),
      ),
    );
    s.on("members:changed", (p: { removed?: string }) => {
      if (p?.removed) setMemberList((list) => list.filter((m) => m.id !== p.removed));
    });
    s.on("kicked", (p: { campaignId: string; campaignName: string }) => {
      if (p.campaignId !== campaign.id) return;
      toast(t("{name} kampanyasından çıkarıldın.", { name: p.campaignName }), "error");
      try {
        sessionStorage.removeItem("shz:lastRoom");
      } catch {
        /* yok say */
      }
      go(panelHref(campaign.system), { replace: true });
    });
    s.on("campaign:closed", (p: { campaignId: string; campaignName: string }) => {
      if (p.campaignId !== campaign.id) return;
      toast(t("{name} odası kapatıldı.", { name: p.campaignName }), "error");
      try {
        sessionStorage.removeItem("shz:lastRoom");
      } catch {
        /* yok say */
      }
      go(panelHref(campaign.system), { replace: true });
    });
    s.on("campaign:settings", (p: { physicalDice: boolean; deathSaveEnabled: boolean }) => {
      setSettings((x) => {
        if (x.physicalDice !== p.physicalDice) toast(p.physicalDice ? t("GM fiziksel zar modunu açtı: zarlar masada atılır, sonucu GM girer.") : t("Fiziksel zar modu kapandı: dijital zar açık."), "ok");
        return { physicalDice: p.physicalDice, deathSaveEnabled: p.deathSaveEnabled };
      });
    });
    s.on("reset:request", (p: { name: string }) => toast(t("{name} şifre sıfırlama istedi. Panelden onaylayabilirsin.", { name: p.name }), "ok"));
    s.on("character:deleted", ({ characterId }: { characterId: string }) => {
      setChars((list) => list.filter((e) => e.character.id !== characterId));
      setViewing((v) => (v === characterId ? null : v));
    });
    s.on("message:deleted", ({ id }: { id: string }) => setMsgs((x) => x.filter((m) => m.id !== id)));
    s.on("roll:rerolled", ({ id }: { id: string }) => setRolls((x) => x.map((r) => (r.id === id ? { ...r, rerolled: true } : r))));
    s.on("presence", (p: { campaignId: string; online: string[] }) => p.campaignId === campaign.id && setOnline(p.online));
    s.on("roll:request", (q: RollReq) => setRequests((x) => (x.some((y) => y.id === q.id) ? x.map((y) => (y.id === q.id ? q : y)) : [...x, q])));
    s.on("roll:request:done", ({ id }: { id: string }) => setRequests((x) => x.filter((q) => q.id !== id)));
    s.on("character:changed", ({ characterId }: { characterId: string }) => refreshChar(characterId));
    s.on("messages:refresh", () => void join());
    return () => {
      s.disconnect();
    };
  }, [campaign.id, campaign.system, refreshChar, toast, join, me.id, pushPopup, go, t]);

  const feed = useMemo<FeedItem[]>(
    () => [...msgs.map((m) => ({ t: "m" as const, at: m.createdAt, m })), ...rolls.map((r) => ({ t: "r" as const, at: r.createdAt, r }))].sort((a, b) => a.at.localeCompare(b.at)),
    [msgs, rolls],
  );
  const myChars = spectator ? [] : chars.filter((e): e is Extract<Entry, { view: "gm" | "owner" }> => e.view !== "public" && (isGM || e.character.userId === me.id) && e.character.status === "ACTIVE");
  const ownChar = chars.find((e) => e.character.userId === me.id && e.character.status !== "REJECTED") ?? null;
  const myRequests = isGM ? requests : requests.filter((q) => q.characters.some((c) => myChars.some((m) => m.character.id === c.id)));

  // Mobilde akış sekmesine dönünce en alta in.
  useEffect(() => {
    if (mobileTab === "akis") setScrollKey((k) => k + 1);
  }, [mobileTab]);

  const party = (
    <Party chars={chars} online={online} isGM={isGM} me={me.id} gm={gm} members={memberList} campaign={campaign} onOpen={setViewing} onMuted={(m) => setMemberList((l) => l.map((x) => (x.id === m.id ? m : x)))} />
  );
  const viewed = chars.find((e) => e.character.id === viewing) ?? null;
  const dice = (
    <DicePanel
      myChars={myChars.map((e) => e.character)}
      allChars={isGM ? chars.filter((e) => e.view === "gm" && e.character.status === "ACTIVE").map((e) => e.character as FullChar) : []}
      isGM={isGM}
      data={data}
      emit={emit}
      deathSaveEnabled={settings.deathSaveEnabled}
      campaignId={campaign.id}
      rollMuted={!isGM && myMute.rollMuted}
      requests={requests}
      spectator={spectator}
    />
  );
  const feedEl = (
    <Feed
      items={feed}
      me={me.id}
      isGM={isGM}
      myChars={myChars.map((e) => e.character)}
      members={memberList}
      gm={gm}
      emit={emit}
      campaignId={campaign.id}
      requests={myRequests}
      chatMuted={!isGM && myMute.chatMuted}
      rollMuted={!isGM && myMute.rollMuted}
      spectator={spectator}
      scrollKey={scrollKey}
      rollKey={rollKey}
    />
  );

  return (
    <SysCtx.Provider value={sys}>
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-10">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="min-w-0">
          <p className="kicker">{t("Oyun odası")}</p>
          <AppLink href={campaignHref(campaign.system, campaign.id)} className="block truncate font-serif text-base text-ink hover:text-accent sm:text-lg">
            {campaign.name}
          </AppLink>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {settings.physicalDice && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 px-3 text-xs text-accent" title={t("Zarlar masada atılır; sonucu GM girer")} data-testid="physical-badge">
              <Dices className="h-4 w-4" /> <span className="hidden sm:inline">{t("Fiziksel zar")}</span>
            </span>
          )}
          {spectator && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted" title={t("İzleyici: sahneye yazamaz, zar atamazsın")}>
              <Eye className="h-4 w-4" /> {t("İzleyici")}
            </span>
          )}
          {!isGM &&
            !spectator &&
            (ownChar ? (
              <AppLink
                href={characterHref(campaign.system, ownChar.character.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/50 px-3 text-sm text-accent hover:bg-accent/10"
                title={ownChar.character.name}
              >
                <UserRound className="h-4 w-4" />
                <span>{t("Karakterim")}</span>
              </AppLink>
            ) : (
              <AppLink href={createCharHref(campaign.system, campaign.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-onAccent hover:bg-accent/90">
                <UserPlus className="h-4 w-4" />
                <span>{t("Karakter Oluştur")}</span>
              </AppLink>
            ))}
          <span className={cx("flex items-center gap-1.5 text-xs", connected ? "text-ok" : "text-danger")} title={connected ? t("Canlı bağlantı") : t("Bağlanıyor")}>
            <span className={cx("h-2 w-2 rounded-full", connected ? "animate-pulse bg-ok" : "bg-danger")} />
            <span className="hidden sm:inline">{connected ? t("Canlı") : t("Bağlanıyor…")}</span>
          </span>
        </div>
      </div>
      <div className="lg:hidden">
        <Tabs
          className="px-2"
          value={mobileTab}
          onChange={setMobileTab}
          tabs={[
            { key: "parti", label: t("Parti") },
            { key: "akis", label: t("Akış"), badge: myRequests.length ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
            { key: "zar", label: t("Zar") },
          ]}
        />
      </div>
      <div className="grid h-[calc(100dvh-10.75rem)] lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[280px_1fr_340px]">
        <div className={cx("min-h-0 overflow-y-auto border-line lg:block lg:border-r", mobileTab === "parti" ? "block" : "hidden")}>{party}</div>
        <div className={cx("min-h-0 lg:flex", mobileTab === "akis" ? "flex" : "hidden")}>{feedEl}</div>
        <div className={cx("min-h-0 overflow-y-auto border-line lg:block lg:border-l", mobileTab === "zar" ? "block" : "hidden")}>{dice}</div>
      </div>
      <RollPopups items={popups} me={me.id} onOpen={() => setMobileTab("akis")} onClose={(id) => setPopups((x) => x.filter((r) => r.id !== id))} />
      <CharacterQuick entry={viewed} data={data} onClose={() => setViewing(null)} />
      <Modal open={askChar} onClose={closeAsk} title={t("Masaya hoş geldin")}>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <UserPlus className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink/90">
              {t("Bu kampanyada henüz bir karakterin yok. Şimdi karakter oluşturmak ister misin? Sihirbaz seni adım adım yönlendirir; karakterin GM onayından sonra masaya katılır.")}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={closeAsk}>{t("Şimdilik izle")}</Button>
            <AppLink href={createCharHref(campaign.system, campaign.id)} onClick={closeAsk} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-onAccent hover:bg-accent/90">
              {t("Karakter oluştur")}
            </AppLink>
          </div>
        </div>
      </Modal>
    </div>
    </SysCtx.Provider>
  );
}

/** Umbra Caelis güçlü başarı: başarılı (ya da değerlendirilmemiş) zarda d20'nin kendisi 15+. */
function ucStrong(d: RollV["detail"]) {
  const d20 = d.parts[0]?.value ?? 0;
  if (d20 < 15 || d.outcome === "fail" || d.outcome === "crit-fail") return null;
  return d.outcome === "success" || d.outcome === "crit-success" ? "sure" : "maybe";
}

// ------------------------------------------------------------------ zar bildirimi
function RollPopups({ items, me, onOpen, onClose }: { items: RollV[]; me: string; onOpen: () => void; onClose: (id: string) => void }) {
  const { system } = useSys();
  const t = useT();
  const tl = useTLoose();
  if (!items.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-[90] flex flex-col items-center gap-2 px-3">
      {items.map((r) => {
        const mine = r.userId === me;
        const d = r.detail;
        const death = r.kind === "death";
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              onOpen();
              onClose(r.id);
            }}
            className={cx(
              "roll-pop pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-surface/95 px-4 py-3 text-left shadow-2xl backdrop-blur",
              death ? (d.outcome === "death" ? "border-danger/70" : "border-ok/60") : mine ? "border-accent/70" : "border-line",
            )}
          >
            <span
              className={cx(
                "grid h-14 w-14 shrink-0 place-items-center rounded-xl font-mono text-3xl font-semibold",
                d.outcome === "crit-success" || d.outcome === "success" || d.outcome === "save" ? "bg-ok/15 text-ok" : d.outcome === "info" ? "bg-surface2 text-ink" : "bg-danger/15 text-danger",
              )}
            >
              {death ? (d.outcome === "death" ? <Skull className="h-7 w-7" /> : <HeartPulse className="h-7 w-7" />) : d.total}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-muted">
                {mine ? t("Senin zarın") : (r.characterName ?? r.userName)} · {tl(r.label)}
              </span>
              <span className="block font-serif text-lg leading-tight text-ink">
                {death
                  ? d.deathTrack?.final === "death"
                    ? t("ÖLDÜ")
                    : d.deathTrack?.final === "save"
                      ? t("HAYATTA KALDI")
                      : d.outcome === "death"
                        ? t("Ölüm {n}/3", { n: d.deathTrack?.deaths ?? "" })
                        : t("Kurtuluş {n}/3", { n: d.deathTrack?.saves ?? "" })
                  : system === "UC" && ucStrong(d) === "sure" && d.outcome === "success"
                    ? t("Güçlü başarı")
                    : (outcomeLabel(d.outcome) && t(outcomeLabel(d.outcome))) || t("Toplam {n}", { n: d.total })}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted">
                {d.parts.map((p, i) => (i === 0 ? `${p.label} ${p.value}` : `${p.value >= 0 ? "+" : "−"}${Math.abs(p.value)}`)).join(" ")}
                {d.threshold != null && !death ? ` · ${system === "UC" ? t("hedef {n}", { n: d.threshold }) : t("eşik {n}", { n: d.threshold })}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ parti
function Party({
  chars,
  online,
  isGM,
  me,
  gm,
  members,
  campaign,
  onOpen,
  onMuted,
}: {
  chars: Entry[];
  online: string[];
  isGM: boolean;
  me: string;
  gm: { id: string; displayName: string };
  members: Member[];
  campaign: { id: string; deathSaveEnabled: boolean };
  onOpen: (id: string) => void;
  onMuted: (m: Member) => void;
}) {
  const toast = useToast();
  const t = useT();
  const { system, uc, deathSaveEnabled } = useSys();
  const [kick, setKick] = useState<Member | null>(null);
  const gmPath = (id: string) => (system === "UC" ? `/api/uc/characters/${id}/gm` : `/api/characters/${id}/gm`);
  const decayMax = system === "UC" ? UC_DECAY_MAX : 13;
  const decayHint = (v: number) => {
    const h = system === "UC" ? UC_DECAY_EFFECTS[v] : CORRUPTION_EFFECTS[v];
    return h ? t(h) : h;
  };
  const setMute = async (u: Member, body: { chatMuted?: boolean; rollMuted?: boolean }) => {
    try {
      const r = await api<{ chatMuted: boolean; rollMuted: boolean; role: Member["role"] }>(`/api/campaigns/${campaign.id}/members/${u.id}`, { method: "PATCH", body });
      onMuted({ ...u, chatMuted: r.chatMuted, rollMuted: r.rollMuted, role: r.role });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const quick = async (id: string, body: Record<string, unknown>, ok?: string) => {
    try {
      await api(gmPath(id), { method: "PATCH", body });
      if (ok) toast(ok, "ok");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="space-y-3 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t("Parti")}</p>
      {chars.length === 0 && <p className="text-sm text-muted">{t("Aktif karakter yok.")}</p>}
      {chars.map((e) => {
        const c = e.character;
        const on = !!c.userId && online.includes(c.userId);
        const full = e.view !== "public" ? (e.character as FullChar) : null;
        const body = full ? normalizeBody(full.body) : null;
        const hurt = body ? BODY_PARTS.filter((p) => body[p.key].wound !== "saglam") : [];
        const dead = c.status === "DEAD";
        return (
          <div key={c.id} className={cx("rounded-xl border bg-surface p-3", dead ? "border-danger/50 bg-danger/[0.05]" : c.userId === me ? "border-accent/40" : "border-line")}>
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onOpen(c.id)} className={cx("relative shrink-0", dead && "grayscale")} title={t("Karakteri görüntüle")}>
                <Portrait id={c.id} version={c.portraitVersion} name={c.name} className="h-12 w-10" />
                {dead && <Skull className="absolute -bottom-1 -right-1 h-4 w-4 rounded bg-bg text-danger" />}
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(c.id)} className={cx("block max-w-full truncate text-left font-serif text-[15px] hover:text-accent", dead ? "text-muted line-through" : "text-ink")}>
                  {c.name}
                </button>
                <p className="text-[11px] text-muted">
                  {t("Sv {n}", { n: c.level })} · {c.userId ? (members.find((m) => m.id === c.userId)?.displayName ?? (c.userId === gm.id ? gm.displayName : "")) : <span className="text-warn">{t("sahipsiz")}</span>}
                  {system === "UC" && uc && c.trees.length > 0 && ` · ${c.trees.map((k) => uc.dals[k]?.name ?? k).join(" / ")}`}
                </p>
                {c.languages?.length > 0 && <p className="truncate text-[10px] text-muted" title={t("Diller")}>{c.languages.join(" · ")}</p>}
              </div>
              <span title={on ? t("Çevrimiçi") : t("Çevrimdışı")} className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", on ? "bg-ok" : "bg-line")} />
            </div>
            {dead && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge tone="danger">{t("Öldü")}</Badge>
                {isGM && (
                  <Button size="sm" variant="outline" onClick={() => quick(c.id, { revive: true }, t("{name} diriltildi.", { name: c.name }))}>
                    <HeartPulse className="h-3.5 w-3.5" /> {t("Dirilt")}
                  </Button>
                )}
              </div>
            )}
            {!dead && c.status !== "ACTIVE" && <Badge tone="warn" className="mt-2">{c.status === "PENDING" ? t("Onay bekliyor") : c.status}</Badge>}
            {full && !dead && (
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted" title={decayHint(full.corruption)}>
                    {t(decayName(system))}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isGM && <MiniBtn onClick={() => quick(c.id, { corruption: Math.max(0, full.corruption - 1) })}>−</MiniBtn>}
                    <span className={cx("w-8 text-center font-mono", full.corruption >= 7 ? "text-danger" : full.corruption >= 4 ? "text-warn" : full.corruption === 0 && "text-ok")}>{full.corruption}</span>
                    {isGM && <MiniBtn onClick={() => quick(c.id, { corruption: Math.min(decayMax, full.corruption + 1) })}>+</MiniBtn>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{t(pointName(system))}</span>
                  <span className="flex items-center gap-1.5">
                    {isGM && <MiniBtn onClick={() => quick(c.id, { inspiration: full.inspiration - 1 })}>−</MiniBtn>}
                    <span className={cx("w-8 text-center font-mono", full.inspiration < 0 && "text-danger")}>{full.inspiration}</span>
                    {isGM && <MiniBtn onClick={() => quick(c.id, { inspiration: full.inspiration + 1 })}>+</MiniBtn>}
                  </span>
                </div>
                {deathSaveEnabled && full.deathSave && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Death Save</span>
                    <DeathPips ds={full.deathSave} />
                  </div>
                )}
                {hurt.length > 0 && <p className="text-danger/90">{hurt.map((p) => `${t(p.label)} −${full && "trees" in full ? bodyPenalty(full as never, body![p.key]) : woundPenalty(body![p.key])}`).join(" · ")}</p>}
                {full.abilityPoints > 0 && <p className="text-accent">{t("Harcanmamış yetenek puanı: {n}", { n: full.abilityPoints })}</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">{t("Masada")}</p>
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2">
            <span className={cx("h-1.5 w-1.5 rounded-full", online.includes(gm.id) ? "bg-ok" : "bg-line")} />
            <span className={cx(online.includes(gm.id) ? "text-ink" : "text-muted")}>{gm.displayName}</span>
            <span className="text-[10px] font-semibold text-accent">GM</span>
          </li>
          {members.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", online.includes(u.id) ? "bg-ok" : "bg-line")} />
              <span className={cx("min-w-0 flex-1 truncate", online.includes(u.id) ? "text-ink" : "text-muted")}>
                {u.displayName}
                {u.role === "SPECTATOR" && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{t("izleyici")}</span>}
              </span>
              {isGM ? (
                <span className="flex shrink-0 gap-1">
                  <MuteBtn active={u.chatMuted} title={u.chatMuted ? t("Sohbet susturmasını kaldır") : t("Sohbette sustur")} onClick={() => setMute(u, { chatMuted: !u.chatMuted })}>
                    <MessageCircleOff className="h-3.5 w-3.5" />
                  </MuteBtn>
                  <MuteBtn active={u.rollMuted} title={u.rollMuted ? t("Zar susturmasını kaldır") : t("Zar atmada sustur")} onClick={() => setMute(u, { rollMuted: !u.rollMuted })}>
                    <Dices className="h-3.5 w-3.5" />
                  </MuteBtn>
                  <MuteBtn
                    active={u.role === "SPECTATOR"}
                    title={u.role === "SPECTATOR" ? t("Oyuncu yap") : t("İzleyici yap")}
                    onClick={async () => {
                      try {
                        const r = await api<{ chatMuted: boolean; rollMuted: boolean; role: Member["role"] }>(`/api/campaigns/${campaign.id}/members/${u.id}`, {
                          method: "PATCH",
                          body: { role: u.role === "SPECTATOR" ? "PLAYER" : "SPECTATOR" },
                        });
                        onMuted({ ...u, ...r });
                      } catch (e) {
                        toast((e as Error).message, "error");
                      }
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </MuteBtn>
                  <MuteBtn active={false} title={t("Oyundan at")} onClick={() => setKick(u)}>
                    <UserX className="h-3.5 w-3.5" />
                  </MuteBtn>
                </span>
              ) : (
                <span className="flex shrink-0 gap-1 text-danger">
                  {u.chatMuted && <MessageCircleOff className="h-3.5 w-3.5" aria-label={t("Sohbette susturuldu")} />}
                  {u.rollMuted && <Dices className="h-3.5 w-3.5" aria-label={t("Zar atmada susturuldu")} />}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Modal open={!!kick} onClose={() => setKick(null)} title={t("Oyuncuyu oyundan at")}>
        <p className="text-sm text-ink/90">
          <strong>{kick?.displayName}</strong>{" "}
          {t("kampanyadan çıkarılacak ve odadan hemen atılacak. Karakterleri silinmez; katılma koduyla yeniden katılabilir (kodu yenileyerek bunu engelleyebilirsin).")}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setKick(null)}>{t("Vazgeç")}</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const u = kick!;
              setKick(null);
              try {
                await api(`/api/campaigns/${campaign.id}/members/${u.id}`, { method: "DELETE" });
                toast(t("{name} oyundan atıldı.", { name: u.displayName }), "ok");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            {t("Oyundan at")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DeathPips({ ds }: { ds: FullChar["deathSave"] }) {
  const t = useT();
  if (!ds.available) return <span className="font-medium text-danger/90">{t("Yok")}</span>;
  return (
    <span className="flex items-center gap-2" title={t("Ölüm {deaths}/3 · Kurtuluş {saves}/3", { deaths: ds.deaths, saves: ds.saves })}>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx("h-2 w-2 rounded-full", i < ds.deaths ? "bg-danger" : "bg-surface2 ring-1 ring-danger/40")} />
        ))}
      </span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx("h-2 w-2 rounded-full", i < ds.saves ? "bg-ok" : "bg-surface2 ring-1 ring-ok/40")} />
        ))}
      </span>
    </span>
  );
}

function MuteBtn({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cx("grid h-7 w-7 place-items-center rounded border transition", active ? "border-danger/60 bg-danger/15 text-danger" : "border-line text-muted hover:text-ink")}
    >
      {children}
    </button>
  );
}

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-6 w-6 rounded border border-line text-[12px] leading-none text-muted hover:border-accent hover:text-ink">
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ akış
type ChatTab = "ic" | "ooc" | "fisilti";

/** GM'in gördüğü oyuncular arası fısıltıların ortak konusu. */
const PLAYERS_THREAD = "__oyuncular";
/**
 * Fısıltının hangi konuşmaya ait olduğu: tarafı olduğum mesajda karşı taraf;
 * GM'in yalnızca izlediği oyuncular arası mesajlar tek bir "Oyuncular arası" konusunda toplanır.
 */
function whisperPeer(m: Msg, me: string) {
  if (m.userId === me) return m.recipientId;
  if (m.recipientId === me) return m.userId;
  return PLAYERS_THREAD;
}

function Feed({
  items,
  me,
  isGM,
  myChars,
  members,
  gm,
  emit,
  campaignId,
  requests,
  chatMuted,
  rollMuted,
  spectator,
  scrollKey,
  rollKey,
}: {
  items: FeedItem[];
  me: string;
  isGM: boolean;
  myChars: FullChar[];
  members: { id: string; displayName: string; role?: "PLAYER" | "SPECTATOR" }[];
  gm: { id: string; displayName: string };
  emit: Emit;
  campaignId: string;
  requests: RollReq[];
  chatMuted: boolean;
  rollMuted: boolean;
  spectator: boolean;
  scrollKey: number;
  rollKey: number;
}) {
  const toast = useToast();
  const t = useT();
  const { system, physical } = useSys();
  const pn = t(pointName(system));
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<ChatTab>("ic");
  const [peer, setPeer] = useState<string>(isGM ? (members[0]?.id ?? "") : gm.id);
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [confirmReroll, setConfirmReroll] = useState<RollV | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  // Çoklu seçim: anahtar "m:<id>" ya da "r:<id>"
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const keyOfItem = (it: FeedItem) => (it.t === "m" ? `m:${it.m.id}` : `r:${it.r.id}`);
  const canSelect = (it: FeedItem) => (isGM ? true : it.t === "m" && it.m.userId === me && it.m.channel !== "SYSTEM");
  const toggleSel = (k: string) =>
    setSel((x) => {
      const n = new Set(x);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSel(new Set());
  };
  // Sahnede oyuncu ilk aktif karakteriyle konuşur; GM anlatıcıdır.
  const speaker = isGM ? null : (myChars[0] ?? null);
  // Fısıltı konuşmaları: GM için her üye + oyuncular arası; oyuncu için GM + diğer oyuncular (izleyiciler yalnızca GM'e yazar).
  const peers: { id: string; name: string }[] = isGM
    ? [...members.map((m) => ({ id: m.id, name: m.displayName })), { id: PLAYERS_THREAD, name: t("Oyuncular arası") }]
    : [
        { id: gm.id, name: `${gm.displayName} (GM)` },
        ...(spectator ? [] : members.filter((m) => m.id !== me && (m.role ?? "PLAYER") === "PLAYER").map((m) => ({ id: m.id, name: m.displayName }))),
      ];
  const readOnlyThread = peer === PLAYERS_THREAD;

  useEffect(() => {
    if (!peers.some((x) => x.id === peer)) setPeer(peers[0]?.id ?? "");
  }, [peers, peer]);

  const inTab = useCallback(
    (it: FeedItem, tb: ChatTab, p?: string) => {
      if (it.t === "r") return tb === "ic";
      const ch = it.m.channel;
      if (tb === "ic") return ch === "IC" || ch === "SYSTEM";
      if (tb === "ooc") return ch === "OOC";
      return ch === "WHISPER" && (!p || whisperPeer(it.m, me) === p);
    },
    [me],
  );
  const view = items.filter((it) => inTab(it, tab, tab === "fisilti" ? peer : undefined));
  const countOf = (tb: ChatTab, p?: string) => items.filter((it) => inTab(it, tb, p) && !(it.t === "m" && it.m.userId === me)).length;
  const keyOf = (tb: ChatTab, p?: string) => (tb === "fisilti" ? `f:${p}` : tb);
  const unread = (tb: ChatTab, p?: string) => Math.max(0, countOf(tb, p) - (seen[keyOf(tb, p)] ?? 0));
  const whisperUnread = peers.reduce((a, x) => a + unread("fisilti", x.id), 0);

  const openKey = keyOf(tab, tab === "fisilti" ? peer : undefined);
  const openCount = countOf(tab, tab === "fisilti" ? peer : undefined);
  useEffect(() => {
    // Açık sekmeyi okunmuş say
    setSeen((s) => (s[openKey] === openCount ? s : { ...s, [openKey]: openCount }));
  }, [openKey, openCount]);
  const first = useRef(true);
  useEffect(() => {
    const b = box.current;
    if (!b || !view.length) return;
    // İlk yüklemede en alta in; sonrasında yalnızca kullanıcı zaten alttaysa takip et.
    if (first.current || b.scrollHeight - b.scrollTop - b.clientHeight < 240) end.current?.scrollIntoView({ block: "end" });
    first.current = false;
  }, [view.length]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    setSel(new Set());
  }, [tab, peer]);
  // Zar atıldığında sahneye geç ve en alta in; mobilde akışa dönünce yalnızca en alta in.
  useEffect(() => {
    if (!rollKey) return;
    setTab("ic");
    const id = window.setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
    return () => window.clearTimeout(id);
  }, [rollKey]);
  useEffect(() => {
    if (!scrollKey) return;
    const id = window.setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 30);
    return () => window.clearTimeout(id);
  }, [scrollKey]);

  const channel = tab === "ic" ? "IC" : tab === "ooc" ? "OOC" : "WHISPER";
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (channel === "WHISPER" && (!peer || readOnlyThread)) return toast(t("Fısıldayacağın kişiyi seç."), "error");
    setSending(true);
    const r = await emit("chat", {
      campaignId,
      channel,
      text: body,
      characterId: channel === "IC" && speaker ? speaker.id : null,
      recipientId: channel === "WHISPER" ? peer : null,
    });
    setSending(false);
    if (!r.ok) return toast(r.error, "error");
    setText("");
  };
  const remove = async (id: string) => {
    const r = await emit("delete", { campaignId, messageId: id });
    if (!r.ok) toast(r.error, "error");
  };
  const removeSelected = async () => {
    const messageIds = [...sel].filter((k) => k.startsWith("m:")).map((k) => k.slice(2));
    const rollIds = [...sel].filter((k) => k.startsWith("r:")).map((k) => k.slice(2));
    const r = await emit("deleteMany", { campaignId, messageIds, rollIds });
    if (!r.ok) return toast(r.error, "error");
    const d = r.data as { messages: number; rolls: number };
    toast(d.rolls ? t("Silindi: {m} mesaj, {r} zar.", { m: d.messages, r: d.rolls }) : t("Silindi: {m} mesaj.", { m: d.messages }), "ok");
    stopSelecting();
  };
  const removeRoll = async (id: string) => {
    const r = await emit("deleteRoll", { campaignId, rollId: id });
    if (!r.ok) toast(r.error, "error");
  };

  const nameOf = (id: string | null) => (id === gm.id ? gm.displayName : id === PLAYERS_THREAD ? t("Oyuncular arası") : (members.find((m) => m.id === id)?.displayName ?? "?"));
  const tabBtn = (tb: ChatTab, label: string, n: number) => (
    <button
      key={tb}
      type="button"
      role="tab"
      aria-selected={tab === tb}
      onClick={() => setTab(tb)}
      className={cx("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition", tab === tb ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
    >
      {label}
      {n > 0 && tab !== tb && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-onAccent">{n > 99 ? "99+" : n}</span>}
    </button>
  );
  const charOf = (id: string | null) => myChars.find((c) => c.id === id) ?? null;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div role="tablist" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 sm:px-4">
        {tabBtn("ic", t("Sahne"), unread("ic"))}
        {tabBtn("ooc", t("Masa"), unread("ooc"))}
        {tabBtn("fisilti", t("Fısıltılar"), whisperUnread)}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-xs", selecting ? "bg-accent/15 text-ink" : "text-muted hover:text-ink")}
            title={isGM ? t("Birden çok mesaj ve zar seçip sil") : t("Kendi mesajlarından birkaçını seçip sil")}
          >
            <CheckSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{selecting ? t("Seçimi bitir") : t("Seç")}</span>
          </button>
          {isGM && (
            <button type="button" onClick={() => setClearOpen(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-danger" title={t("Sohbet veya zar geçmişini temizle")}>
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("Temizle")}</span>
            </button>
          )}
        </span>
      </div>
      {tab === "fisilti" && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line px-3 py-2 sm:px-5" data-testid="whisper-peers">
          {isGM && members.length === 0 && <span className="text-xs text-muted">{t("Kampanyada oyuncu yok.")}</span>}
          {peers.map((m) => {
            const n = unread("fisilti", m.id);
            const pp = m.id === PLAYERS_THREAD;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPeer(m.id)}
                title={pp ? t("Oyuncuların birbirine fısıldadıkları (salt okunur)") : undefined}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                  pp && "border-dashed",
                  peer === m.id ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                {pp && <Eye className="h-3 w-3" />}
                {m.name}
                {n > 0 && peer !== m.id && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-onAccent">{n}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
        {view.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {tab === "ic"
              ? t("Sahne boş. Karakterinle konuş ya da zar at.")
              : tab === "ooc"
                ? t("Oyun dışı sohbet burada. Herkes görür.")
                : readOnlyThread
                  ? t("Oyuncuların birbirine fısıldadıkları burada görünür. Bu konuşmalara yazamazsın.")
                  : !peer
                    ? t("Fısıldamak için birini seç.")
                    : peer === gm.id
                      ? t("GM ile özel konuşma. Bunu yalnızca sen ve GM görürsünüz.")
                      : isGM
                        ? t("{name} ile özel konuşma. Bunu yalnızca ikiniz görürsünüz.", { name: nameOf(peer) })
                        : t("{name} ile özel konuşma. Diğer oyuncular göremez; GM masadaki tüm fısıltıları görür.", { name: nameOf(peer) })}
          </p>
        )}
        {view.map((it) => {
          const k = keyOfItem(it);
          const body =
          it.t === "m" ? (
            <MessageRow key={`m${it.m.id}`} m={it.m} me={me} nameOf={nameOf} canDelete={isGM || it.m.userId === me} onDelete={() => remove(it.m.id)} />
          ) : (
            <RollCard
              key={`r${it.r.id}`}
              r={it.r}
              canDelete={isGM}
              onDelete={() => removeRoll(it.r.id)}
              canReroll={
                !physical && !it.r.rerolled && !!it.r.characterId && !["death", "pervitin", "decay"].includes(it.r.kind) && (isGM || (charOf(it.r.characterId)?.inspiration ?? 0) > 0)
              }
              onReroll={() => setConfirmReroll(it.r)}
            />
          );
          if (!selecting) return <div key={k}>{body}</div>;
          const ok = canSelect(it);
          const on = sel.has(k);
          return (
            <div key={k} className={cx("flex items-start gap-2 rounded-lg", on && "bg-accent/[0.08] ring-1 ring-accent/40")}>
              <button
                type="button"
                disabled={!ok}
                onClick={() => toggleSel(k)}
                className={cx("mt-2 shrink-0 rounded p-0.5", ok ? "text-accent hover:bg-accent/15" : "invisible")}
                aria-label={on ? t("Seçimi kaldır") : t("Seç")}
                aria-pressed={on}
              >
                {on ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1" onClick={() => ok && toggleSel(k)}>
                {body}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {selecting && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-accent/40 bg-accent/[0.06] px-3 py-2 text-sm sm:px-6">
          <span className="text-ink">{t("Seçilen öğe: {n}", { n: sel.size })}</span>
          <button
            type="button"
            className="text-xs text-muted hover:text-ink"
            onClick={() => setSel(new Set(view.filter(canSelect).map(keyOfItem)))}
          >
            {t("Görünenlerin tümünü seç")}
          </button>
          {sel.size > 0 && (
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setSel(new Set())}>
              {t("Temizle")}
            </button>
          )}
          <span className="ml-auto flex gap-2">
            <Button size="sm" onClick={stopSelecting}>
              {t("Vazgeç")}
            </Button>
            <Button size="sm" variant="danger" disabled={!sel.size} onClick={removeSelected}>
              <Trash2 className="h-3.5 w-3.5" /> {t("Seçilenleri sil")}
            </Button>
          </span>
        </div>
      )}
      {requests.length > 0 && !selecting && <RequestBar requests={requests} isGM={isGM} myChars={myChars} emit={emit} campaignId={campaignId} rollMuted={rollMuted} />}
      <form
        className="border-t border-line px-3 py-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {tab === "ic" && !isGM && !speaker && (
          <p className="mb-2 text-xs text-muted">
            {spectator ? t("İzleyicisin: sahneye yazamazsın. Masa sohbetine ya da GM'e fısıltıyla yazabilirsin.") : t("Sahnede konuşmak için onaylanmış bir karakterin olmalı. Masa ve Fısıltılar herkese açık.")}
          </p>
        )}
        {chatMuted && (tab !== "fisilti" || peer !== gm.id) && (
          <p className="mb-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">{t("GM seni sohbette susturdu. Yine de GM'e fısıldayabilirsin.")}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={
              tab === "ic"
                ? isGM
                  ? t("Anlatıcı olarak yaz…")
                  : speaker
                    ? t("{name} ne söylüyor / yapıyor?", { name: speaker.name })
                    : spectator
                      ? t("İzleyiciler sahneye yazamaz")
                      : t("Karakterin yok")
                : tab === "ooc"
                  ? t("Masaya bir not… (herkes görür)")
                  : readOnlyThread
                    ? t("Oyuncular arası konuşmalar salt okunur")
                    : peer === gm.id
                      ? t("GM'e gizli mesaj…")
                      : t("{name} için gizli mesaj…", { name: nameOf(peer) })
            }
            className="input min-h-[44px] resize-none"
          />
          <Button type="submit" variant="primary" className="h-11" disabled={sending || !text.trim() || (chatMuted && (tab !== "fisilti" || peer !== gm.id)) || (tab === "ic" && !isGM && !speaker) || (tab === "fisilti" && readOnlyThread)}>
            {t("Gönder")}
          </Button>
        </div>
      </form>
      <Modal open={!!confirmReroll} onClose={() => setConfirmReroll(null)} title={t("{point} harcansın mı?", { point: pn })}>
        {confirmReroll && (
          <div className="space-y-4">
            <p className="text-sm text-ink/90">
              {t("Bu zarı 1 {point} harcayarak yeniden atacaksın. Yeni sonuç geçerli olur, eskisi iptal edilir.", { point: pn })}
            </p>
            <RollCard r={confirmReroll} canReroll={false} onReroll={() => {}} />
            {!isGM && charOf(confirmReroll.characterId) && (
              <p className="text-xs text-muted">
                {t("Kalan {point}:", { point: pn })} <span className="font-mono text-ink">{charOf(confirmReroll.characterId)!.inspiration}</span> → <span className="font-mono text-ink">{charOf(confirmReroll.characterId)!.inspiration - 1}</span>
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmReroll(null)}>{t("Vazgeç")}</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const r = confirmReroll;
                  setConfirmReroll(null);
                  const res = await emit("reroll", { campaignId, rollId: r.id });
                  if (!res.ok) toast(res.error, "error");
                }}
              >
                {t("Harca ve yeniden at")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ClearModal open={clearOpen} onClose={() => setClearOpen(false)} emit={emit} campaignId={campaignId} tab={tab} peer={readOnlyThread ? "" : peer} peerName={nameOf(peer)} />
    </div>
  );
}

type ClearChoice = "IC" | "OOC" | "WHISPER_PEER" | "WHISPER" | "ROLLS" | "ALL";
function ClearModal({ open, onClose, emit, campaignId, tab, peer, peerName }: { open: boolean; onClose: () => void; emit: Emit; campaignId: string; tab: ChatTab; peer: string; peerName: string }) {
  const toast = useToast();
  const t = useT();
  const [choice, setChoice] = useState<ClearChoice>("IC");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setChoice(tab === "ic" ? "IC" : tab === "ooc" ? "OOC" : "WHISPER_PEER");
  }, [open, tab]);
  const opts: [ClearChoice, string, string][] = [
    ["IC", t("Sahne mesajları"), t("Karakter konuşmaları ve sistem mesajları. Zarlar kalır.")],
    ["OOC", t("Masa sohbeti"), t("Oyun dışı sohbetin tamamı.")],
    ["WHISPER_PEER", t("{name} ile fısıltılar", { name: peerName }), t("Yalnızca bu oyuncuyla olan özel konuşma.")],
    ["WHISPER", t("Tüm fısıltılar"), t("Bütün oyuncularla olan özel konuşmalar.")],
    ["ROLLS", t("Zar geçmişi"), t("Tüm zar kayıtları. Mesajlar kalır.")],
    ["ALL", t("Her şey"), t("Bütün mesajlar, fısıltılar ve zarlar.")],
  ];
  return (
    <Modal open={open} onClose={onClose} title={t("Geçmişi temizle")}>
      <div className="space-y-2">
        {opts
          .filter(([k]) => k !== "WHISPER_PEER" || !!peer)
          .map(([k, label, hint]) => (
            <label key={k} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", choice === k ? "border-danger/60 bg-danger/[0.07]" : "border-line")}>
              <input type="radio" name="clear" checked={choice === k} onChange={() => setChoice(k)} className="mt-0.5 accent-[rgb(224,87,75)]" />
              <span>
                <span className="block font-medium text-ink">{label}</span>
                <span className="text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        <p className="pt-1 text-xs text-muted">{t("Silinenler geri getirilemez. Tek tek silmek için \"Seç\" düğmesini kullan.")}</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const jobs: [string, unknown][] = [];
              if (choice === "ROLLS" || choice === "ALL") jobs.push(["clearRolls", { campaignId }]);
              if (choice === "ALL") jobs.push(["clearMessages", { campaignId, scope: "ALL" }]);
              if (choice === "IC" || choice === "OOC" || choice === "WHISPER") jobs.push(["clearMessages", { campaignId, scope: choice }]);
              if (choice === "WHISPER_PEER") jobs.push(["clearMessages", { campaignId, scope: "WHISPER", peerId: peer }]);
              for (const [ev, p] of jobs) {
                const r = await emit(ev, p);
                if (!r.ok) {
                  setBusy(false);
                  return toast(r.error, "error");
                }
              }
              setBusy(false);
              toast(t("Temizlendi."), "ok");
              onClose();
            }}
          >
            {t("Temizle")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function reqSummary(q: RollReq, system: Sys, t: TFn, tl: (s: string) => string) {
  const bits: string[] = [];
  if (q.kind === "check") bits.push(q.stat ? statLabelOf(system, q.stat) : t("Statsız"));
  if (q.kind === "decay" && q.decayMode) bits.push(t(UC_DECAY_MODES[q.decayMode].label));
  if (q.thresholdLabel) bits.push(tl(q.thresholdLabel) + (q.thresholdValue == null && q.threshold ? ` (${THRESHOLDS.find((x) => x.key === q.threshold)?.value})` : ""));
  if (q.modifier) bits.push(t("durum {mod}", { mod: `${q.modifier > 0 ? "+" : ""}${q.modifier}` }));
  if (q.blackMagic) bits.push(t("kara büyü"));
  if (q.magic) bits.push(t("büyü zarı"));
  if (q.decay) bits.push(t("yoz zar"));
  if (q.hidden) bits.push(t("sonuç gizli"));
  return bits.join(" · ");
}

function RequestBar({ requests, isGM, myChars, emit, campaignId, rollMuted }: { requests: RollReq[]; isGM: boolean; myChars: FullChar[]; emit: Emit; campaignId: string; rollMuted: boolean }) {
  const toast = useToast();
  const t = useT();
  const tl = useTLoose();
  const { system } = useSys();
  const [parts, setParts] = useState<Record<string, BodyPartKey | "">>({});
  const [busy, setBusy] = useState(false);
  const answer = async (q: RollReq, characterId: string) => {
    setBusy(true);
    const r =
      q.kind === "death"
        ? await emit("death", { campaignId, characterId, requestId: q.id })
        : q.kind === "pervitin"
          ? await emit("pervitin", { campaignId, characterId, requestId: q.id })
          : q.kind === "decay"
            ? await emit("decay", { campaignId, characterId, mode: q.decayMode ?? "dusotu", requestId: q.id })
            : await emit("roll", {
              campaignId,
              characterId,
              stat: q.stat,
              threshold: q.threshold,
              part: q.playerPart ? parts[q.id] || null : null,
              modifier: 0,
              blackMagic: q.blackMagic,
              magic: !!q.magic,
              decay: !!q.decay,
              label: q.label,
              hidden: false,
              requestId: q.id,
            });
    setBusy(false);
    if (!r.ok) toast(r.error, "error");
  };
  return (
    <div className="max-h-[40%] shrink-0 space-y-2 overflow-y-auto border-t border-accent/40 bg-accent/[0.06] px-3 py-3 sm:px-6">
      {requests.map((q) => {
        const mine = q.characters.filter((c) => myChars.some((m) => m.id === c.id) && (!isGM || true));
        return (
          <div key={q.id} className={cx("rounded-lg border px-3 py-2 text-sm", q.kind === "death" ? "border-danger/50 bg-danger/[0.07]" : "border-accent/30 bg-surface/60")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p>
                  <strong className={q.kind === "death" ? "text-danger" : "text-accent"}>{q.kind === "death" ? "☠ Death Save" : q.kind === "pervitin" ? t("Pervitin zarı") : q.kind === "decay" ? t("Yozlaşma zarı") : t("GM zar istiyor")}:</strong> {tl(q.label)}
                </p>
                <p className="text-xs text-muted">{reqSummary(q, system, t, tl)}</p>
                {isGM && <p className="mt-0.5 text-xs text-muted">{t("Bekleniyor:")} {q.characters.map((c) => c.name).join(", ")}</p>}
              </div>
              {isGM && (
                <Button size="sm" variant="ghost" onClick={() => emit("cancelRequest", { campaignId, requestId: q.id })}>
                  {t("İptal")}
                </Button>
              )}
            </div>
            {!isGM && mine.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {q.playerPart && (
                  <select className="input h-8 w-auto py-0 text-xs" value={parts[q.id] ?? ""} onChange={(e) => setParts({ ...parts, [q.id]: e.target.value as BodyPartKey | "" })}>
                    <option value="">{t("Uzuv yok")}</option>
                    {BODY_PARTS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {t(p.label)}
                      </option>
                    ))}
                  </select>
                )}
                {mine.map((c) => (
                  <Button key={c.id} size="sm" variant={q.kind === "death" ? "danger" : "primary"} disabled={rollMuted || busy} onClick={() => answer(q, c.id)}>
                    {mine.length > 1 ? t("{name} için at", { name: c.name }) : q.kind === "death" ? t("Death Save at (d6)") : t("Zarı at")}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function time(s: string, loc: Locale) {
  return new Date(s).toLocaleTimeString(intlLocale(loc), { hour: "2-digit", minute: "2-digit" });
}

function DeleteBtn({ onDelete, title: titleProp }: { onDelete: () => void; title?: string }) {
  const t = useT();
  const title = titleProp ?? t("Mesajı sil");
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="ml-2 inline-flex items-center gap-1 text-[11px]">
      <button type="button" className="rounded bg-danger/20 px-1.5 text-danger hover:bg-danger/30" onClick={onDelete}>
        {t("Sil")}
      </button>
      <button type="button" className="rounded px-1.5 text-muted hover:text-ink" onClick={() => setAsk(false)}>
        {t("Vazgeç")}
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setAsk(true)}
      className="ml-1 rounded p-0.5 text-muted transition hover:text-danger focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      title={title}
      aria-label={title}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function MessageRow({ m, me, nameOf, canDelete, onDelete }: { m: Msg; me: string; nameOf: (id: string | null) => string; canDelete: boolean; onDelete: () => void }) {
  const t = useT();
  const tl = useTLoose();
  const loc = useLocale();
  const del = canDelete ? <DeleteBtn onDelete={onDelete} /> : null;
  if (m.channel === "SYSTEM")
    return (
      <div className="group flex items-center justify-center py-1">
        <span className="rounded-full border border-line bg-surface2/60 px-3 py-1 text-center text-xs text-muted">{systemTextOf(tl, t, m.content)}</span>
        {del}
      </div>
    );
  if (m.channel === "WHISPER") {
    const mine = m.userId === me;
    return (
      <div className={cx("group flex", mine ? "justify-end" : "justify-start")}>
        <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-sm bg-accent/20" : "rounded-bl-sm border border-line bg-surface2")}>
          <p className="mb-0.5 text-[11px] text-muted">
            {mine ? t("Sen") : m.recipientId === me ? nameOf(m.userId) : `${nameOf(m.userId)} → ${nameOf(m.recipientId)}`} · {time(m.createdAt, loc)}
            {del}
          </p>
          <p className="whitespace-pre-wrap break-words">{m.content}</p>
        </div>
      </div>
    );
  }
  if (m.channel === "OOC")
    return (
      <div className="group rounded-lg px-2 py-1 hover:bg-surface2/40">
        <p className="text-[11px] text-muted">
          <span className="font-medium text-ink/80">{m.userName}</span> · {time(m.createdAt, loc)}
          {del}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink/90">{m.content}</p>
      </div>
    );
  return (
    <div className="group rounded-lg px-2 py-1 hover:bg-surface2/30">
      <p className="text-[11px] text-muted">
        <span className="font-serif text-[15px] text-accent">{m.characterName ?? t("{name} (anlatıcı)", { name: m.userName })}</span> · {time(m.createdAt, loc)}
        {del}
      </p>
      <p className="whitespace-pre-wrap break-words font-serif text-[15px] text-ink">{m.content}</p>
    </div>
  );
}

const OUTCOME_TONE: Record<string, string> = {
  success: "border-ok/50 bg-ok/10 text-ok",
  "crit-success": "border-accent bg-accent/20 text-accent",
  fail: "border-danger/50 bg-danger/10 text-danger",
  "crit-fail": "border-danger bg-danger/20 text-danger",
  death: "border-danger/50 bg-danger/10 text-danger",
  save: "border-ok/50 bg-ok/10 text-ok",
  info: "border-line bg-surface2 text-muted",
};

function RollCard({ r, canReroll, onReroll, canDelete, onDelete }: { r: RollV; canReroll: boolean; onReroll: () => void; canDelete?: boolean; onDelete?: () => void }) {
  const d = r.detail;
  const { system } = useSys();
  const t = useT();
  const tl = useTLoose();
  const loc = useLocale();
  if (r.kind === "death") return <DeathCard r={r} canDelete={canDelete} onDelete={onDelete} />;
  return (
    <div className={cx("group rounded-xl border bg-surface px-3 py-3 sm:px-4", r.rerolled ? "border-line opacity-50" : "border-line", r.hidden && "border-dashed")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">
            {r.characterName ?? r.userName} · {time(r.createdAt, loc)}
            {r.hidden && ` · ${t("gizli")}`}
            {r.rerolled && ` · ${t("yeniden atıldı")}`}
            {d.requested && ` · ${t("GM isteği")}`}
            {d.physical && ` · ${t("fiziksel zar (GM girdi)")}`}
            {r.kind === "buyu" && ` · ${t("büyü zarı")}`}
            {r.kind === "yoz" && ` · ${t("yoz zar")}`}
            {canDelete && onDelete && <DeleteBtn onDelete={onDelete} title={t("Zarı sil")} />}
          </p>
          <p className="font-medium text-ink">{tl(r.label)}</p>
        </div>
        <div className="flex items-center gap-2">
          {d.outcome !== "info" && <span className={cx("rounded-md border px-2 py-0.5 text-xs font-semibold", OUTCOME_TONE[d.outcome])}>{t(outcomeLabel(d.outcome))}</span>}
          {system === "UC" && ucStrong(d) && (
            <span
              className="rounded-md border border-accent/50 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent"
              title={ucStrong(d) === "sure" ? t("Başarılı zarda d20 15+") : t("d20 15+: başarılıysa güçlü başarıdır (GM değerlendirir)")}
              data-testid="uc-strong"
            >
              {ucStrong(d) === "sure" ? t("Güçlü") : "d20 15+"}
            </span>
          )}
          <span className="grid h-11 min-w-11 place-items-center rounded-lg bg-surface2 px-2 font-mono text-2xl text-ink">{d.total}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {d.parts.map((p, i) => (
          <span key={i} className={cx("rounded px-1.5 py-0.5 font-mono", i === 0 ? "bg-accent/15 text-accent" : p.value < 0 ? "bg-danger/10 text-danger" : "bg-surface2 text-ink/80")}>
            {partLabelOf(t, tl, p.label)} {i === 0 ? p.value : `${p.value >= 0 ? "+" : ""}${p.value}`}
          </span>
        ))}
        {d.threshold != null && (
          <span className="text-muted">
            ≥ {d.threshold} ({d.thresholdLabel ? tl(d.thresholdLabel) : d.thresholdLabel})
          </span>
        )}
      </div>
      {d.note && (r.kind === "pervitin" || r.kind === "decay") && <p className="mt-1.5 text-xs text-ink/80">{tl(d.note)}</p>}
      {d.extra && <p className="mt-1.5 rounded-md bg-lav/10 px-2 py-1 text-xs text-ink/85">{extraText(tl, d.extra)}</p>}
      {canReroll && (
        <button type="button" onClick={onReroll} className="mt-2 text-xs text-accent hover:underline">
          {t("{point} harca, yeniden at", { point: t(pointName(system)) })}
        </button>
      )}
    </div>
  );
}

function DeathCard({ r, canDelete, onDelete }: { r: RollV; canDelete?: boolean; onDelete?: () => void }) {
  const d = r.detail;
  const tr = d.deathTrack;
  const dead = d.outcome === "death";
  const final = tr?.final;
  const t = useT();
  const tl = useTLoose();
  const loc = useLocale();
  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-xl border px-3 py-3 sm:px-4",
        final === "death" ? "death-final border-danger bg-danger/15" : final === "save" ? "border-ok bg-ok/10" : dead ? "border-danger/60 bg-danger/[0.07]" : "border-ok/50 bg-ok/[0.06]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">
            {r.characterName ?? r.userName} · {time(r.createdAt, loc)} · Death Save
            {d.physical && ` · ${t("fiziksel zar")}`}
            {canDelete && onDelete && <DeleteBtn onDelete={onDelete} title={t("Zarı sil")} />}
          </p>
          <p className={cx("font-serif text-lg", dead ? "text-danger" : "text-ok")}>
            {final === "death" ? t("☠ Karakter öldü") : final === "save" ? t("✚ Hayatta kaldı") : dead ? t("Ölüme bir adım daha…") : t("Hayata tutunuyor")}
          </p>
        </div>
        <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-lg font-mono text-2xl", dead ? "bg-danger/20 text-danger" : "bg-ok/20 text-ok")} title={t("d6: 1–3 ölüm, 4–6 kurtuluş")}>
          {d.total}
        </span>
      </div>
      {tr && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <Skull className="h-3.5 w-3.5 text-danger" />
            {[0, 1, 2].map((i) => (
              <span key={i} className={cx("h-2.5 w-2.5 rounded-full", i < (final ? (final === "death" ? 3 : 0) : tr.deaths) ? "bg-danger" : "bg-surface2 ring-1 ring-danger/40")} />
            ))}
          </span>
          <span className="flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-ok" />
            {[0, 1, 2].map((i) => (
              <span key={i} className={cx("h-2.5 w-2.5 rounded-full", i < (final ? (final === "save" ? 3 : 0) : tr.saves) ? "bg-ok" : "bg-surface2 ring-1 ring-ok/40")} />
            ))}
          </span>
          <span className="text-muted">{t("d6: 1–3 ölüm · 4–6 kurtuluş")}</span>
        </div>
      )}
      {d.note && <p className="mt-1.5 text-xs text-ink/85">{tl(d.note)}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ zar paneli
function ThresholdPicker({ value, manual, onChange, allowManual }: { value: string | null; manual: number | null; onChange: (key: string | null, manual: number | null) => void; allowManual: boolean }) {
  const { system } = useSys();
  const t = useT();
  // Umbra Caelis: eşik yok; zorluğu GM belirler. İsterse sonucun otomatik değerlendirilmesi için bir hedef sayı girer (oyuncu görmez).
  if (system === "UC")
    return (
      <div>
        <span className="label">{t("Hedef sayı (isteğe bağlı)")}</span>
        {allowManual ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChange(null, null)} className={cx("rounded-md border px-3 py-1.5 text-xs", manual === null ? "border-accent bg-accent/15" : "border-line text-muted")}>
              {t("Yok")}
            </button>
            <label className={cx("flex flex-1 items-center gap-2 rounded-md border px-2 text-xs", manual !== null ? "border-accent bg-accent/15" : "border-line text-muted")}>
              <span>{t("Sayı")}</span>
              <input
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={manual ?? ""}
                placeholder={t("GM belirler")}
                data-testid="uc-threshold"
                onChange={(e) => onChange(null, e.target.value === "" ? null : Math.max(1, Math.min(60, Number(e.target.value))))}
                className="h-8 w-full min-w-0 bg-transparent text-center font-mono text-ink outline-none"
              />
            </label>
          </div>
        ) : (
          <p className="rounded-md border border-line bg-surface2/50 px-3 py-1.5 text-xs text-muted">{t("Zorluğu GM belirler; sonucu GM değerlendirir.")}</p>
        )}
      </div>
    );
  return (
    <div>
      <span className="label">{t("Eşik")}</span>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={() => onChange(null, null)} className={cx("rounded-md border px-1 py-1.5 text-xs", value === null && manual === null ? "border-accent bg-accent/15" : "border-line text-muted")}>
          {t("Yok")}
        </button>
        {THRESHOLDS.map((th) => (
          <button
            key={th.key}
            type="button"
            onClick={() => onChange(th.key, null)}
            className={cx("rounded-md border px-1 py-1.5 text-xs", value === th.key && manual === null ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}
          >
            {t(th.label)} <span className="font-mono">{th.value}</span>
          </button>
        ))}
        {allowManual && (
          <label className={cx("flex items-center gap-1 rounded-md border px-1.5 text-xs", manual !== null ? "border-accent bg-accent/15" : "border-line text-muted")}>
            <span>{t("Elle")}</span>
            <input
              type="number"
              min={1}
              max={60}
              inputMode="numeric"
              value={manual ?? ""}
              placeholder="—"
              onChange={(e) => onChange(null, e.target.value === "" ? null : Math.max(1, Math.min(60, Number(e.target.value))))}
              className="h-7 w-full min-w-0 bg-transparent text-center font-mono text-ink outline-none"
            />
          </label>
        )}
      </div>
    </div>
  );
}

function StatPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const { system } = useSys();
  const t = useT();
  return (
    <div>
      <span className="label">Stat</span>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={() => onChange("")} className={cx("rounded-md border px-1 py-1.5 text-xs", value === "" ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}>
          {t("Statsız")}
        </button>
        {statKeysOf(system).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(value === k ? "" : k)}
            className={cx("rounded-md border px-1 py-1.5 text-xs", value === k ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}
          >
            {statLabelOf(system, k)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModifierPicker({ value, onChange, label = "Durum düzenleyici" }: { value: number; onChange: (n: number) => void; label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <span className="label mb-0">{t(label)}</span>
      <span className="flex items-center gap-1.5">
        <MiniBtn onClick={() => onChange(Math.max(-20, value - 1))}>−</MiniBtn>
        <span className={cx("w-9 text-center font-mono", value > 0 ? "text-ok" : value < 0 && "text-danger")}>{value > 0 ? `+${value}` : value}</span>
        <MiniBtn onClick={() => onChange(Math.min(20, value + 1))}>+</MiniBtn>
        {value !== 0 && (
          <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => onChange(0)}>
            {t("sıfırla")}
          </button>
        )}
      </span>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[rgb(186,168,240)]" />
      {children}
    </label>
  );
}

/** Fiziksel zar: masada gelen değer (GM girer). */
function DieInput({ sides, value, onChange }: { sides: 6 | 20; value: number | null; onChange: (n: number | null) => void }) {
  const t = useT();
  return (
    <label className="block">
      <span className="label">{t("Masada gelen zar (d{sides})", { sides })}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={sides}
          inputMode="numeric"
          className="input w-24 text-center font-mono text-lg"
          value={value ?? ""}
          placeholder="—"
          data-testid="physical-die"
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(1, Math.min(sides, Math.round(Number(e.target.value)))))}
        />
        <div className="flex flex-wrap gap-1">
          {(sides === 6 ? [1, 2, 3, 4, 5, 6] : [1, 20]).map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)} className={cx("h-8 min-w-8 rounded border px-1.5 font-mono text-xs", value === n ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </label>
  );
}

function DicePanel({
  myChars,
  allChars,
  isGM,
  data,
  emit,
  deathSaveEnabled,
  campaignId,
  rollMuted,
  requests,
  spectator,
}: {
  myChars: FullChar[];
  allChars: FullChar[];
  isGM: boolean;
  data: RulesData;
  emit: Emit;
  deathSaveEnabled: boolean;
  campaignId: string;
  rollMuted: boolean;
  requests: RollReq[];
  spectator: boolean;
}) {
  const toast = useToast();
  const t = useT();
  const tl = useTLoose();
  const { system, physical } = useSys();
  const uc = system === "UC";
  const choices = isGM ? allChars : myChars;
  const [charId, setCharId] = useState<string>(choices[0]?.id ?? "");
  const [stat, setStat] = useState<string>(uc ? "yalman" : "korp");
  const [threshold, setThreshold] = useState<string | null>(uc ? null : "orta");
  const [manual, setManual] = useState<number | null>(null);
  const [part, setPart] = useState<BodyPartKey | "">("");
  const [mod, setMod] = useState(0);
  const [bm, setBm] = useState(false);
  const [magic, setMagic] = useState(false);
  const [yoz, setYoz] = useState(false);
  const [label, setLabel] = useState("");
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  // Fiziksel zar (yalnızca GM): zar türü ve masada gelen değer
  const [pkind, setPkind] = useState<"check" | "corr" | "death">("check");
  const [die, setDie] = useState<number | null>(null);
  const [dmode, setDmode] = useState<UcDecayMode>("dusotu");

  useEffect(() => {
    if (isGM && charId === "") return; // GM bilerek karaktersiz d20 seçti
    if (!choices.some((c) => c.id === charId)) setCharId(choices[0]?.id ?? "");
  }, [choices, charId, isGM]);
  const ch = choices.find((c) => c.id === charId) ?? null;
  const ucr = ch && uc ? ucPreview(ch, { stat, part, modifier: mod, magic, decay: yoz }) : null;
  const parts = ch
    ? uc
      ? ucr!.parts
      : checkModifiers(ch, { stat: (stat || null) as StatKey | null, part: part || null, modifier: mod, blackMagic: bm }, data)
    : mod
      ? [{ label: "Düzenleyici", value: mod }]
      : [];
  const sum = parts.reduce((a, b) => a + b.value, 0);
  const thBase = manual ?? (uc ? null : (THRESHOLDS.find((x) => x.key === threshold)?.value ?? null));
  // Mors · Ağır beden: fiziksel zarlarda eşik 2 kademe yükselir (sunucu da aynısını uygular).
  const morsHeavy = !uc && !!ch && isMors(ch) && !!stat && PHYSICAL_STATS.includes(stat as StatKey);
  const thValue = thBase != null && morsHeavy ? morsThreshold({ value: thBase, label: "" }, manual != null ? null : threshold).value : thBase;

  const doEmit = async (ev: string, payload: unknown) => {
    setBusy(true);
    const r = await emit(ev, payload);
    setBusy(false);
    if (!r.ok) toast(r.error, "error");
    return r.ok;
  };
  const checkPayload = (extra: Record<string, unknown> = {}) => ({
    campaignId,
    characterId: ch?.id ?? null,
    stat: ch ? stat || null : null,
    threshold: uc || manual !== null ? null : threshold,
    thresholdValue: isGM ? manual : null,
    part: ch ? part || null : null,
    modifier: mod,
    blackMagic: !uc && !!ch && bm,
    magic: uc && !!ch && magic,
    decay: uc && !!ch && yoz,
    label,
    hidden: isGM && hidden,
    ...extra,
  });

  const charSelect = (allowNone: boolean) => (
    <label className="block">
      <span className="label">{physical ? t("Zarı atan") : t("Karakter")}</span>
      <select className="input" value={charId} onChange={(e) => setCharId(e.target.value)} data-testid="dice-char">
        {allowNone && <option value="">{t("GM (karaktersiz d20)")}</option>}
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  const flags = ch && (
    <>
      {uc ? (
        <>
          <Check checked={magic} onChange={setMagic}>
            {t("Büyü zarı")} <span className="text-xs text-muted">{t("(Nat1 → mana geri tepmesi)")}</span>
          </Check>
          <Check checked={yoz} onChange={setYoz}>
            {t("Yoz zar")} <span className="text-xs text-muted">{t("(Yozlaşma bonusu, tavana sayılır)")}</span>
          </Check>
        </>
      ) : (
        <Check checked={bm} onChange={setBm}>
          {t("Kara büyü zarı (Corruption etkileri)")}
        </Check>
      )}
    </>
  );
  const partSelect = ch && (
    <label className="block">
      <span className="label">{t("Kullanılan uzuv (yara cezası)")}</span>
      <select className="input" value={part} onChange={(e) => setPart(e.target.value as BodyPartKey | "")}>
        <option value="">{t("Yok")}</option>
        {BODY_PARTS.map((p) => {
          const pen = !uc && ch.trees ? bodyPenalty(ch, normalizeBody(ch.body)[p.key]) : woundPenalty(normalizeBody(ch.body)[p.key]);
          return (
            <option key={p.key} value={p.key}>
              {t(p.label)}
              {pen ? ` (−${pen})` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
  const preview = (first: string) => (
    <div className="rounded-lg border border-line bg-surface2/50 px-3 py-2 text-xs">
      <span className="text-muted">{first} </span>
      {parts.map((p, i) => (
        <span key={i} className={cx(p.value < 0 ? "text-danger" : "text-ink/80")}>
          {" "}
          {p.value >= 0 ? "+" : "−"} {Math.abs(p.value)} <span className="text-muted">{partLabelOf(t, tl, p.label)}</span>
        </span>
      ))}
      <span className="ml-1 font-mono text-ink"> = {first} {sum >= 0 ? "+" : "−"} {Math.abs(sum)}</span>
      {thValue != null && <span className="ml-1 text-muted">≥ {thValue}</span>}
      {morsHeavy && (
        <span className="mt-1 block text-[11px] text-lav" data-testid="mors-heavy">
          {t("Mors · Ağır beden: eşik 2 kademe yükselir.")}
        </span>
      )}
      {ucr && (
        <span className="mt-1 block text-[11px] text-muted">
          {t("Bonus tavanı +{n}", { n: ucr.cap })}
          {ucr.overflow > 0 && <span className="text-lav"> · {t("taşan +{n} anlatıma döner", { n: ucr.overflow })}</span>}
        </span>
      )}
    </div>
  );

  // ---------------- fiziksel zar modu
  if (physical && !isGM)
    return (
      <div className="space-y-4 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t("Zar · fiziksel masa")}</p>
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-3 text-sm" data-testid="physical-player-note">
          <p className="flex items-center gap-2 font-medium text-ink">
            <Dices className="h-4 w-4 text-accent" /> {t("Zarlar masada atılıyor")}
          </p>
          <p className="mt-1 text-ink/85">{t("Zarını gerçek zarla at ve sonucu GM'e söyle. GM sonucu sisteme girer; başarı ve karakterine etkisi Akış'ta görünür.")}</p>
        </div>
      </div>
    );
  if (physical && isGM) {
    const sides = pkind === "death" ? 6 : 20;
    const needTh = pkind === "corr";
    const canSend = die != null && !busy && (pkind === "check" || !!ch) && (!needTh || thValue != null) && (pkind !== "death" || (deathSaveEnabled && !!ch?.deathSave.available));
    return (
      <div className="space-y-4 p-4" data-testid="physical-gm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t("Fiziksel zar · sonucu gir")}</p>
        <p className="text-xs text-muted">{t("Oyuncu zarı masada attı: atan karakteri, zar türünü ve gelen sayıyı seç. Sistem başarıyı ve {decay} / Death Save etkisini hesaplar.", { decay: t(decayName(system)) })}</p>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["check", t("Normal zar")],
              ["corr", uc ? t("Yozlaşma") : "Pervitin"],
              ["death", "Death Save"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={pkind === k}
              disabled={k === "death" && !deathSaveEnabled}
              onClick={() => {
                setPkind(k);
                setDie(null);
              }}
              className={cx("rounded-md px-2 py-1.5 text-xs transition disabled:opacity-40", pkind === k ? (k === "death" ? "bg-danger/20 text-ink" : "bg-accent/20 text-ink") : "text-muted hover:text-ink")}
            >
              {l}
            </button>
          ))}
        </div>
        {charSelect(pkind === "check")}
        {pkind === "check" && (
          <>
            {ch && <StatPicker value={stat} onChange={setStat} />}
            <ThresholdPicker value={threshold} manual={manual} allowManual onChange={(k, m) => (setThreshold(k), setManual(m))} />
            {partSelect}
            <ModifierPicker value={mod} onChange={setMod} label={uc ? "Bonus / ceza" : "Durum düzenleyici"} />
            {flags}
            <Check checked={hidden} onChange={setHidden}>
              {t("Gizli (yalnızca GM görür)")}
            </Check>
            <input className="input" placeholder={t("Açıklama (ör. Kapıyı kır)")} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
            {preview(die != null ? String(die) : "d20")}
          </>
        )}
        {pkind === "corr" && (
          <>
            {uc && (
              <label className="block">
                <span className="label">{t("Yozlaşma zarı")}</span>
                <select className="input" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)}>
                  {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                    <option key={k} value={k}>
                      {t(UC_DECAY_MODES[k].label)}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted">{t(UC_DECAY_MODES[dmode].hint)}</span>
              </label>
            )}
            {!uc && <p className="text-[11px] text-muted">{t("d20 + Sanita − Corruption/3 + durum ≥ eşik; başarısızlıkta +1 Corruption.")}</p>}
            <ThresholdPicker value={threshold} manual={manual} allowManual onChange={(k, m) => (setThreshold(k), setManual(m))} />
            <ModifierPicker value={mod} onChange={setMod} label="GM düzenleyici (±)" />
          </>
        )}
        {pkind === "death" && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs">
            {t("d6: 1–3 ölüm, 4–6 kurtuluş.")} {ch && !ch.deathSave.available && <strong className="text-danger">{t("{name} için Death Save hakkı yok.", { name: ch.name })}</strong>}
          </p>
        )}
        <DieInput sides={sides} value={die} onChange={setDie} />
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSend}
          data-testid="physical-submit"
          onClick={async () => {
            const ok =
              pkind === "death"
                ? await doEmit("death", { campaignId, characterId: ch!.id, physical: die })
                : pkind === "corr"
                  ? uc
                    ? await doEmit("decay", { campaignId, characterId: ch!.id, mode: dmode, thresholdValue: thValue, modifier: mod, physical: die })
                    : await doEmit("pervitin", { campaignId, characterId: ch!.id, threshold: manual === null ? threshold : null, thresholdValue: manual, modifier: mod, physical: die })
                  : await doEmit("roll", checkPayload({ physical: die }));
            if (ok) {
              setDie(null);
              setLabel("");
            }
          }}
        >
          <Dices className="h-5 w-5" /> {t("Sonucu gir")}
        </Button>
      </div>
    );
  }

  // ---------------- dijital zar
  return (
    <div className="space-y-4 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{uc ? t("Zar · d20 + stat + bonus · güçlü başarı: d20 15+") : t("Zar · d20 + stat ≥ eşik")}</p>
      {rollMuted && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">{t("GM seni zar atmada susturdu.")}</p>}
      {!isGM && requests.some((q) => q.characters.some((c) => myChars.some((m) => m.id === c.id))) && (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">{t("GM senden zar istiyor. Akış sekmesinin altındaki isteği yanıtla.")}</p>
      )}
      {spectator && (
        <p className="flex items-start gap-2 rounded-md border border-line bg-surface2/60 px-3 py-2 text-sm text-muted">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" /> {t("İzleyicisin: zar atamazsın. Atılan zarlar Sahne sekmesinde görünür.")}
        </p>
      )}
      {choices.length === 0 && !isGM && !spectator && <p className="text-sm text-muted">{t("Zar atmak için onaylanmış bir karakterin olmalı.")}</p>}
      {(choices.length > 0 || isGM) && (
        <>
          {charSelect(isGM)}
          {ch && <StatPicker value={stat} onChange={setStat} />}
          <ThresholdPicker
            value={threshold}
            manual={manual}
            allowManual={isGM}
            onChange={(k, m) => {
              setThreshold(k);
              setManual(m);
            }}
          />
          {partSelect}
          <ModifierPicker value={mod} onChange={setMod} label={uc ? "Bonus / ceza" : "Durum düzenleyici"} />
          {flags}
          {isGM && (
            <Check checked={hidden} onChange={setHidden}>
              {t("Gizli at (yalnızca GM görür)")}
            </Check>
          )}
          <input className="input" placeholder={t("Açıklama (ör. Kapıyı kır)")} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          {preview("d20")}
          <div className="sticky bottom-0 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0">
            <Button variant="primary" size="lg" className="w-full" disabled={busy || rollMuted || (!ch && !isGM)} onClick={() => doEmit("roll", checkPayload()).then((ok) => ok && setLabel(""))}>
              <Dices className="h-5 w-5" /> {t("Zar at")}
            </Button>
          </div>
          {isGM && ch && (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy || !deathSaveEnabled || !ch.deathSave.available} onClick={() => doEmit("death", { campaignId, characterId: ch.id })} title={!deathSaveEnabled ? t("Kampanyada kapalı") : t("GM doğrudan atar")}>
                <Skull className="h-4 w-4" /> Death Save
              </Button>
              {uc ? (
                <Button
                  disabled={busy || thValue == null}
                  onClick={() => doEmit("decay", { campaignId, characterId: ch.id, mode: dmode, thresholdValue: thValue, modifier: mod })}
                  title={thValue == null ? t("Önce hedef sayı gir") : t(UC_DECAY_MODES[dmode].hint)}
                >
                  <MoonStar className="h-4 w-4" /> {t(UC_DECAY_MODES[dmode].label)}
                </Button>
              ) : (
                <Button
                  disabled={busy || thValue == null}
                  onClick={() => doEmit("pervitin", { campaignId, characterId: ch.id, threshold: manual === null ? threshold : null, thresholdValue: manual, modifier: mod })}
                  title={t("d20 + Sanita − Corruption/3 + durum ≥ eşik")}
                >
                  Pervitin
                </Button>
              )}
              {uc && (
                <select className="input col-span-2 h-9 py-1 text-xs" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)} aria-label={t("Yozlaşma zarı türü")}>
                  {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                    <option key={k} value={k}>
                      {t("Yozlaşma zarı: {mode}", { mode: t(UC_DECAY_MODES[k].label) })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {!isGM && <p className="text-[11px] text-muted">{t("Death Save ve {kind} zarlarını GM ister; istek gelince Akış'ın altında belirir.", { kind: uc ? t("Yozlaşma") : "Pervitin" })}</p>}
        </>
      )}
      {isGM && !physical && (
        <div className="border-t border-line pt-4">
          <Button variant="outline" className="w-full" disabled={!allChars.length} onClick={() => setReqOpen(true)}>
            {t("Oyunculardan zar iste")}
          </Button>
          <RequestModal open={reqOpen} onClose={() => setReqOpen(false)} chars={allChars} emit={emit} campaignId={campaignId} deathSaveEnabled={deathSaveEnabled} />
        </div>
      )}
    </div>
  );
}

function RequestModal({ open, onClose, chars, emit, campaignId, deathSaveEnabled }: { open: boolean; onClose: () => void; chars: FullChar[]; emit: Emit; campaignId: string; deathSaveEnabled: boolean }) {
  const toast = useToast();
  const t = useT();
  const { system } = useSys();
  const uc = system === "UC";
  const [kind, setKind] = useState<RollReq["kind"]>("check");
  const [ids, setIds] = useState<string[]>([]);
  const [stat, setStat] = useState<string>(uc ? "sebahat" : "sanita");
  const [threshold, setThreshold] = useState<string | null>(uc ? null : "orta");
  const [manual, setManual] = useState<number | null>(null);
  const [mod, setMod] = useState(0);
  const [label, setLabel] = useState("");
  const [bm, setBm] = useState(false);
  const [magic, setMagic] = useState(false);
  const [yoz, setYoz] = useState(false);
  const [dmode, setDmode] = useState<UcDecayMode>("dusotu");
  const [hidden, setHidden] = useState(false);
  const [playerPart, setPlayerPart] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligible = kind === "death" ? chars.filter((c) => c.deathSave.available) : chars;
  const needTh = kind === "pervitin" || kind === "decay";
  const hasTh = uc ? manual !== null : threshold !== null || manual !== null;
  return (
    <Modal open={open} onClose={onClose} title={t("Oyunculardan zar iste")} wide>
      <div className="space-y-4">
        <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["check", t("Normal zar")],
              ["death", "Death Save"],
              uc ? ["decay", t("Yozlaşma zarı")] : ["pervitin", "Pervitin"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              disabled={k === "death" && !deathSaveEnabled}
              onClick={() => setKind(k as RollReq["kind"])}
              className={cx("rounded-md px-3 py-1.5 text-sm transition disabled:opacity-40", kind === k ? (k === "death" ? "bg-danger/20 text-ink" : "bg-accent/20 text-ink") : "text-muted hover:text-ink")}
            >
              {l}
            </button>
          ))}
        </div>
        <div>
          <span className="label">{t("Kimler?")}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip" onClick={() => setIds(ids.length === eligible.length ? [] : eligible.map((c) => c.id))}>
              {ids.length === eligible.length && eligible.length ? t("Hiçbiri") : t("Herkes")}
            </button>
            {chars.map((c) => {
              const ok = eligible.includes(c);
              return (
                <label key={c.id} className={cx("chip cursor-pointer", ids.includes(c.id) && "border-accent text-accent", !ok && "opacity-40")} title={!ok ? t("Death Save hakkı yok") : undefined}>
                  <input type="checkbox" className="hidden" disabled={!ok} checked={ids.includes(c.id)} onChange={(e) => setIds(e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))} />
                  {c.name}
                </label>
              );
            })}
          </div>
        </div>
        {kind === "check" && <StatPicker value={stat} onChange={setStat} />}
        {kind === "decay" && (
          <label className="block">
            <span className="label">{t("Yozlaşma zarı")}</span>
            <select className="input" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)}>
              {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                <option key={k} value={k}>
                  {t(UC_DECAY_MODES[k].label)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">{t(UC_DECAY_MODES[dmode].hint)}</span>
          </label>
        )}
        {kind !== "death" && (
          <ThresholdPicker
            value={threshold}
            manual={manual}
            allowManual
            onChange={(k, m) => {
              setThreshold(k);
              setManual(m);
            }}
          />
        )}
        {kind === "death" && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{t("d6 atılır: 1–3 ölüm, 4–6 kurtuluş. Üç ölümde karakter ölür, üç kurtuluşta kritik yaralı hayatta kalır.")}</p>}
        {kind !== "death" && <ModifierPicker value={mod} onChange={setMod} label={kind === "check" ? (uc ? "Bonus / ceza" : "Durum düzenleyici") : "GM düzenleyici (±)"} />}
        <input className="input" placeholder={t("Açıklama (ör. Ritüeli gördünüz)")} maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {kind === "check" && (
            <>
              {uc ? (
                <>
                  <Check checked={magic} onChange={setMagic}>
                    {t("Büyü zarı")}
                  </Check>
                  <Check checked={yoz} onChange={setYoz}>
                    {t("Yoz zar")}
                  </Check>
                </>
              ) : (
                <Check checked={bm} onChange={setBm}>
                  {t("Kara büyü zarı")}
                </Check>
              )}
              <Check checked={playerPart} onChange={setPlayerPart}>
                {t("Oyuncu kullandığı uzvu seçsin")}
              </Check>
            </>
          )}
          <Check checked={hidden} onChange={setHidden}>
            {t("Sonucu yalnızca ben ve atan görsün")}
          </Check>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("Vazgeç")}</Button>
          <Button
            variant="primary"
            disabled={!ids.length || busy || (needTh && !hasTh)}
            onClick={async () => {
              setBusy(true);
              const r = await emit("request", {
                campaignId,
                characterIds: ids.filter((id) => eligible.some((c) => c.id === id)),
                kind,
                stat: kind === "check" ? stat || null : null,
                threshold: uc || manual !== null ? null : threshold,
                thresholdValue: manual,
                modifier: kind === "death" ? 0 : mod,
                label,
                blackMagic: !uc && kind === "check" && bm,
                magic: uc && kind === "check" && magic,
                decay: uc && kind === "check" && yoz,
                ...(kind === "decay" ? { decayMode: dmode } : {}),
                hidden,
                playerPart: kind === "check" && playerPart,
              });
              setBusy(false);
              if (!r.ok) return toast(r.error, "error");
              toast(t("Zar isteği gönderildi."), "ok");
              onClose();
              setIds([]);
              setLabel("");
            }}
          >
            {t("İste")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ karakter görünümü (oda içinde)
function CharacterQuick({ entry, data, onClose }: { entry: Entry | null; data: RulesData; onClose: () => void }) {
  const { system, uc } = useSys();
  const t = useT();
  const c = entry?.character;
  const full = entry && entry.view !== "public" ? (entry.character as FullChar) : null;
  return (
    <Modal open={!!entry} onClose={onClose} title={c?.name ?? ""} wide>
      {c && (
        <div className="space-y-5">
          <div className="flex gap-4">
            <Portrait id={c.id} version={c.portraitVersion} name={c.name} className="h-[125px] w-[100px]" />
            <div className="min-w-0 space-y-1.5 text-sm">
              <p className="text-muted">
                {t("Seviye {n}", { n: c.level })} · {t("{n} yaş", { n: c.age })} · {c.nationality} · {c.alignment}
              </p>
              {c.status === "DEAD" && <Badge tone="danger">{t("Öldü")}</Badge>}
              <div className="flex flex-wrap gap-2">
                {c.trees.map((tk) =>
                  system === "UC" ? (
                    <span key={tk} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
                      {t("K{n}", { n: uc?.dals[tk]?.tier })} · {uc?.dals[tk]?.name ?? tk}
                    </span>
                  ) : (
                    <span key={tk} className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-0.5 pr-2.5 text-xs text-accent">
                      <TreeIcon treeKey={tk} className="h-6 w-6 rounded-full" />
                      {data.trees.find((x) => x.key === tk)?.name}
                    </span>
                  ),
                )}
              </div>
              {c.languages?.length > 0 && <p className="text-xs text-muted">{t("Diller:")} {c.languages.join(", ")}</p>}
              {c.appearance && <p className="text-ink/80">{c.appearance}</p>}
              <AppLink href={characterHref(system, c.id)} target="_blank" className="inline-block text-xs text-accent hover:underline">
                {t("Tam karakter kağıdını yeni sekmede aç ↗")}
              </AppLink>
            </div>
          </div>
          {full ? (
            system === "UC" ? (
              <QuickFullUc c={full} />
            ) : (
              <QuickFull c={full} data={data} />
            )
          ) : (
            <p className="text-sm text-muted">{t("Diğer oyuncuların karakter kağıtlarının yalnızca bu kısmı görünür.")}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function QuickFullUc({ c }: { c: FullChar }) {
  const { uc } = useSys();
  const t = useT();
  const stats = ucNormalizeStats(c.stats as unknown as Record<string, number>);
  const body = normalizeBody(c.body);
  const owned = Object.entries(c.abilities).filter(([, v]) => v > 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2">
        {UC_STAT_KEYS.map((k) => (
          <div key={k} className="rounded-lg border border-line bg-surface2/50 px-2 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">{UC_STAT_LABELS[k]}</p>
            <p className="font-mono text-lg">{stats[k]}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <BodyDiagram body={body} className="mx-auto max-w-[160px]" />
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted">{t("Yozlaşma:")}</span> <span className="font-mono">{c.corruption}</span> · <span className="text-muted">{t("Esin:")}</span> <span className="font-mono">{c.inspiration}</span> ·{" "}
            <span className="text-muted">{t("Bonus tavanı:")}</span> <span className="font-mono">+{ucBonusCap(c.level)}</span> · <span className="text-muted">Death Save:</span>{" "}
            {c.deathSave.available ? t("Var") : t("Yok")}
          </p>
          {c.corruption > 0 && UC_DECAY_EFFECTS[c.corruption] && <p className="text-xs text-lav">{t(UC_DECAY_EFFECTS[c.corruption])}</p>}
          {BODY_PARTS.filter((p) => body[p.key].wound !== "saglam").map((p) => (
            <p key={p.key} className="text-danger/90">
              {t(p.label)}: −{woundPenalty(body[p.key])}
            </p>
          ))}
        </div>
      </div>
      {owned.length > 0 && (
        <div>
          <p className="kicker mb-2">{t("Yetenekler")}</p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {owned.map(([k, lv]) => (
              <li key={k} className="rounded-md border border-line px-3 py-1.5">
                {uc?.abilities[k]?.name ?? k} <span className="font-mono text-xs text-accent">{t("Sv {n}", { n: lv })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.perks.length > 0 && (
        <div>
          <p className="kicker mb-2">{t("Perkler")}</p>
          <p className="text-sm">{c.perks.map((k) => uc?.perks.find((p) => p.key === k)?.name ?? k).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function QuickFull({ c, data }: { c: FullChar; data: RulesData }) {
  const t = useT();
  const eff = effectiveStats(c, data);
  const body = normalizeBody(c.body);
  const augs = installedAugments(c.body, data);
  const owned = Object.entries(c.abilities).filter(([, v]) => v > 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAT_KEYS.map((k) => (
          <div key={k} className="rounded-lg border border-line bg-surface2/50 px-2 py-1.5 text-center">
            <p lang="de" className="text-[10px] uppercase tracking-wider text-muted">
              {STAT_LABELS[k]}
            </p>
            <p className={cx("font-mono text-lg", eff[k].value < 0 && "text-danger")}>{eff[k].value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <BodyDiagram body={body} className="mx-auto max-w-[160px]" />
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted">Corruption:</span> <span className="font-mono">{c.corruption}</span> · <span className="text-muted">Inspiration:</span>{" "}
            <span className="font-mono">{c.inspiration}</span> · <span className="text-muted">Death Save:</span> {c.deathSave.available ? t("Var") : t("Yok")}
          </p>
          {BODY_PARTS.filter((p) => body[p.key].wound !== "saglam").map((p) => (
            <p key={p.key} className="text-danger/90">
              {t(p.label)}: −{bodyPenalty(c, body[p.key])}
            </p>
          ))}
          {augs.map(({ part, augment }) => (
            <p key={part}>
              <span className="text-accent">{augment.name}</span> <span className="text-muted">({t(BODY_PARTS.find((b) => b.key === part)?.label ?? part)})</span>
            </p>
          ))}
        </div>
      </div>
      {c.corruption > 0 && <CorruptionEffects value={c.corruption} mors={isMors(c)} />}
      {owned.length > 0 && (
        <div>
          <p className="kicker mb-2">{t("Yetenekler")}</p>
          <div className="grid gap-2 md:grid-cols-2">{owned.map(([k, lv]) => (data.abilities[k] ? <AbilityCard key={k} ability={data.abilities[k]} level={lv} /> : null))}</div>
        </div>
      )}
      {c.perks.length > 0 && (
        <div>
          <p className="kicker mb-2">{t("Perkler")}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {c.perks.map((k) => {
              const p = data.perks.find((x) => x.key === k);
              return p ? <PerkCard key={k} perk={p} /> : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
