"use client";
import { CheckSquare, Dices, Eye, HandMetal, HeartPulse, MessageCircleOff, MoonStar, Skull, Square, Trash2, UserPlus, UserRound, UserX } from "lucide-react";
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
import { checkModifiers, effectiveStats, installedAugments, normalizeBody, outcomeLabel, woundPenalty } from "@/lib/shz/rules";
import { campaignHref, characterHref, createCharHref, panelHref, type Sys } from "@/lib/links";
import { UC_STAT_KEYS, UC_STAT_LABELS, type UcStatKey } from "@/lib/uc/constants";
import { UC_DECAY_EFFECTS, UC_DECAY_MAX, UC_DECAY_MODES, ucBonusCap, ucCheckParts, ucNormalizeStats, type UcDecayMode, type UcRules } from "@/lib/uc/rules";

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
          if (!s?.connected) return resolve({ ok: false, error: "Bağlantı yok. Birkaç saniye içinde yeniden bağlanılacak." });
          s.timeout(10_000).emit(ev, payload, (err: Error | null, r: Ack) => resolve(err ? { ok: false, error: "Sunucu yanıt vermedi." } : r));
        });
      let r = await once();
      // Bağlantı koptuysa ya da oda üyeliği düştüyse bir kez yeniden katılıp tekrar dene.
      if (!r.ok && /odaya katıl|Bağlantı yok/.test(r.error)) {
        sock.current?.connect();
        await new Promise((res) => setTimeout(res, 600));
        if (await join()) r = await once();
      }
      return r;
    },
    [join],
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
    const s = io({ path: `${BASE_PATH}/socket.io`, withCredentials: true, transports: ["websocket", "polling"] });
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
      toast(`${p.campaignName} kampanyasından çıkarıldın.`, "error");
      try {
        sessionStorage.removeItem("shz:lastRoom");
      } catch {
        /* yok say */
      }
      go(panelHref(campaign.system), { replace: true });
    });
    s.on("campaign:closed", (p: { campaignId: string; campaignName: string }) => {
      if (p.campaignId !== campaign.id) return;
      toast(`${p.campaignName} odası kapatıldı.`, "error");
      try {
        sessionStorage.removeItem("shz:lastRoom");
      } catch {
        /* yok say */
      }
      go(panelHref(campaign.system), { replace: true });
    });
    s.on("campaign:settings", (p: { physicalDice: boolean; deathSaveEnabled: boolean }) => {
      setSettings((x) => {
        if (x.physicalDice !== p.physicalDice) toast(p.physicalDice ? "GM fiziksel zar modunu açtı: zarlar masada atılır, sonucu GM girer." : "Fiziksel zar modu kapandı: dijital zar açık.", "ok");
        return { physicalDice: p.physicalDice, deathSaveEnabled: p.deathSaveEnabled };
      });
    });
    s.on("reset:request", (p: { name: string }) => toast(`${p.name} şifre sıfırlama istedi. Panelden onaylayabilirsin.`, "ok"));
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
  }, [campaign.id, campaign.system, refreshChar, toast, join, me.id, pushPopup, go]);

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
          <p className="kicker">Oyun odası</p>
          <AppLink href={campaignHref(campaign.system, campaign.id)} className="block truncate font-serif text-base text-ink hover:text-accent sm:text-lg">
            {campaign.name}
          </AppLink>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {settings.physicalDice && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 px-3 text-xs text-accent" title="Zarlar masada atılır; sonucu GM girer" data-testid="physical-badge">
              <HandMetal className="h-4 w-4" /> <span className="hidden sm:inline">Fiziksel zar</span>
            </span>
          )}
          {spectator && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted" title="İzleyici: sahneye yazamaz, zar atamazsın">
              <Eye className="h-4 w-4" /> İzleyici
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
                <span>Karakterim</span>
              </AppLink>
            ) : (
              <AppLink href={createCharHref(campaign.system, campaign.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-onAccent hover:bg-accent/90">
                <UserPlus className="h-4 w-4" />
                <span>Karakter Oluştur</span>
              </AppLink>
            ))}
          <span className={cx("flex items-center gap-1.5 text-xs", connected ? "text-ok" : "text-danger")} title={connected ? "Canlı bağlantı" : "Bağlanıyor"}>
            <span className={cx("h-2 w-2 rounded-full", connected ? "animate-pulse bg-ok" : "bg-danger")} />
            <span className="hidden sm:inline">{connected ? "Canlı" : "Bağlanıyor…"}</span>
          </span>
        </div>
      </div>
      <div className="lg:hidden">
        <Tabs
          className="px-2"
          value={mobileTab}
          onChange={setMobileTab}
          tabs={[
            { key: "parti", label: "Parti" },
            { key: "akis", label: "Akış", badge: myRequests.length ? <span className="h-2 w-2 rounded-full bg-accent" /> : undefined },
            { key: "zar", label: "Zar" },
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
      <Modal open={askChar} onClose={closeAsk} title="Masaya hoş geldin">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <UserPlus className="h-5 w-5" />
            </span>
            <p className="text-sm text-ink/90">
              Bu kampanyada henüz bir karakterin yok. Şimdi karakter oluşturmak ister misin? Sihirbaz seni adım adım yönlendirir; karakterin GM onayından sonra masaya katılır.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={closeAsk}>Şimdilik izle</Button>
            <AppLink href={createCharHref(campaign.system, campaign.id)} onClick={closeAsk} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-onAccent hover:bg-accent/90">
              Karakter oluştur
            </AppLink>
          </div>
        </div>
      </Modal>
    </div>
    </SysCtx.Provider>
  );
}

// ------------------------------------------------------------------ zar bildirimi
function RollPopups({ items, me, onOpen, onClose }: { items: RollV[]; me: string; onOpen: () => void; onClose: (id: string) => void }) {
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
                {mine ? "Senin zarın" : (r.characterName ?? r.userName)} · {r.label}
              </span>
              <span className="block font-serif text-lg leading-tight text-ink">
                {death ? (d.deathTrack?.final === "death" ? "ÖLDÜ" : d.deathTrack?.final === "save" ? "HAYATTA KALDI" : d.outcome === "death" ? `Ölüm ${d.deathTrack?.deaths ?? ""}/3` : `Kurtuluş ${d.deathTrack?.saves ?? ""}/3`) : outcomeLabel(d.outcome) || `Toplam ${d.total}`}
              </span>
              <span className="block truncate font-mono text-[11px] text-muted">
                {d.parts.map((p, i) => (i === 0 ? `${p.label} ${p.value}` : `${p.value >= 0 ? "+" : "−"}${Math.abs(p.value)}`)).join(" ")}
                {d.threshold != null && !death ? ` · eşik ${d.threshold}` : ""}
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
  const { system, uc, deathSaveEnabled } = useSys();
  const [kick, setKick] = useState<Member | null>(null);
  const gmPath = (id: string) => (system === "UC" ? `/api/uc/characters/${id}/gm` : `/api/characters/${id}/gm`);
  const decayMax = system === "UC" ? UC_DECAY_MAX : 13;
  const decayHint = (v: number) => (system === "UC" ? UC_DECAY_EFFECTS[v] : CORRUPTION_EFFECTS[v]);
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
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Parti</p>
      {chars.length === 0 && <p className="text-sm text-muted">Aktif karakter yok.</p>}
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
              <button type="button" onClick={() => onOpen(c.id)} className={cx("relative shrink-0", dead && "grayscale")} title="Karakteri görüntüle">
                <Portrait id={c.id} version={c.portraitVersion} name={c.name} className="h-12 w-10" />
                {dead && <Skull className="absolute -bottom-1 -right-1 h-4 w-4 rounded bg-bg text-danger" />}
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onOpen(c.id)} className={cx("block max-w-full truncate text-left font-serif text-[15px] hover:text-accent", dead ? "text-muted line-through" : "text-ink")}>
                  {c.name}
                </button>
                <p className="text-[11px] text-muted">
                  Sv {c.level} · {c.userId ? (members.find((m) => m.id === c.userId)?.displayName ?? (c.userId === gm.id ? gm.displayName : "")) : <span className="text-warn">sahipsiz</span>}
                  {system === "UC" && uc && c.trees.length > 0 && ` · ${c.trees.map((t) => uc.dals[t]?.name ?? t).join(" / ")}`}
                </p>
                {c.languages?.length > 0 && <p className="truncate text-[10px] text-muted" title="Diller">{c.languages.join(" · ")}</p>}
              </div>
              <span title={on ? "Çevrimiçi" : "Çevrimdışı"} className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", on ? "bg-ok" : "bg-line")} />
            </div>
            {dead && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge tone="danger">Öldü</Badge>
                {isGM && (
                  <Button size="sm" variant="outline" onClick={() => quick(c.id, { revive: true }, `${c.name} diriltildi.`)}>
                    <HeartPulse className="h-3.5 w-3.5" /> Dirilt
                  </Button>
                )}
              </div>
            )}
            {!dead && c.status !== "ACTIVE" && <Badge tone="warn" className="mt-2">{c.status === "PENDING" ? "Onay bekliyor" : c.status}</Badge>}
            {full && !dead && (
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted" title={decayHint(full.corruption)}>
                    {decayName(system)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {isGM && <MiniBtn onClick={() => quick(c.id, { corruption: Math.max(0, full.corruption - 1) })}>−</MiniBtn>}
                    <span className={cx("w-8 text-center font-mono", full.corruption >= 7 ? "text-danger" : full.corruption >= 4 ? "text-warn" : full.corruption === 0 && "text-ok")}>{full.corruption}</span>
                    {isGM && <MiniBtn onClick={() => quick(c.id, { corruption: Math.min(decayMax, full.corruption + 1) })}>+</MiniBtn>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{pointName(system)}</span>
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
                {hurt.length > 0 && <p className="text-danger/90">{hurt.map((p) => `${p.label} −${woundPenalty(body![p.key])}`).join(" · ")}</p>}
                {full.abilityPoints > 0 && <p className="text-accent">{full.abilityPoints} yetenek puanı harcanmamış</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">Masada</p>
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
                {u.role === "SPECTATOR" && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">izleyici</span>}
              </span>
              {isGM ? (
                <span className="flex shrink-0 gap-1">
                  <MuteBtn active={u.chatMuted} title={u.chatMuted ? "Sohbet susturmasını kaldır" : "Sohbette sustur"} onClick={() => setMute(u, { chatMuted: !u.chatMuted })}>
                    <MessageCircleOff className="h-3.5 w-3.5" />
                  </MuteBtn>
                  <MuteBtn active={u.rollMuted} title={u.rollMuted ? "Zar susturmasını kaldır" : "Zar atmada sustur"} onClick={() => setMute(u, { rollMuted: !u.rollMuted })}>
                    <Dices className="h-3.5 w-3.5" />
                  </MuteBtn>
                  <MuteBtn
                    active={u.role === "SPECTATOR"}
                    title={u.role === "SPECTATOR" ? "Oyuncu yap" : "İzleyici yap"}
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
                  <MuteBtn active={false} title="Oyundan at" onClick={() => setKick(u)}>
                    <UserX className="h-3.5 w-3.5" />
                  </MuteBtn>
                </span>
              ) : (
                <span className="flex shrink-0 gap-1 text-danger">
                  {u.chatMuted && <MessageCircleOff className="h-3.5 w-3.5" aria-label="Sohbette susturuldu" />}
                  {u.rollMuted && <Dices className="h-3.5 w-3.5" aria-label="Zar atmada susturuldu" />}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Modal open={!!kick} onClose={() => setKick(null)} title="Oyuncuyu oyundan at">
        <p className="text-sm text-ink/90">
          <strong>{kick?.displayName}</strong> kampanyadan çıkarılacak ve odadan hemen atılacak. Karakterleri silinmez; katılma koduyla yeniden katılabilir (kodu yenileyerek bunu
          engelleyebilirsin).
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setKick(null)}>Vazgeç</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const u = kick!;
              setKick(null);
              try {
                await api(`/api/campaigns/${campaign.id}/members/${u.id}`, { method: "DELETE" });
                toast(`${u.displayName} oyundan atıldı.`, "ok");
              } catch (e) {
                toast((e as Error).message, "error");
              }
            }}
          >
            Oyundan at
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DeathPips({ ds }: { ds: FullChar["deathSave"] }) {
  if (!ds.available) return <span className="font-medium text-danger/90">Yok</span>;
  return (
    <span className="flex items-center gap-2" title={`Ölüm ${ds.deaths}/3 · Kurtuluş ${ds.saves}/3`}>
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

/** Fısıltının karşı tarafı (GM açısından oyuncu, oyuncu açısından GM). */
function whisperPeer(m: Msg, me: string) {
  return m.userId === me ? m.recipientId : m.userId;
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
  members: { id: string; displayName: string }[];
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
  const { system, physical } = useSys();
  const pn = pointName(system);
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

  useEffect(() => {
    if (isGM && !members.some((m) => m.id === peer)) setPeer(members[0]?.id ?? "");
  }, [isGM, members, peer]);

  const inTab = useCallback(
    (it: FeedItem, t: ChatTab, p?: string) => {
      if (it.t === "r") return t === "ic";
      const ch = it.m.channel;
      if (t === "ic") return ch === "IC" || ch === "SYSTEM";
      if (t === "ooc") return ch === "OOC";
      return ch === "WHISPER" && (!p || whisperPeer(it.m, me) === p);
    },
    [me],
  );
  const view = items.filter((it) => inTab(it, tab, tab === "fisilti" ? peer : undefined));
  const countOf = (t: ChatTab, p?: string) => items.filter((it) => inTab(it, t, p) && !(it.t === "m" && it.m.userId === me)).length;
  const keyOf = (t: ChatTab, p?: string) => (t === "fisilti" ? `f:${p}` : t);
  const unread = (t: ChatTab, p?: string) => Math.max(0, countOf(t, p) - (seen[keyOf(t, p)] ?? 0));
  const whisperUnread = isGM ? members.reduce((a, m) => a + unread("fisilti", m.id), 0) : unread("fisilti", gm.id);

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
    const t = text.trim();
    if (!t) return;
    if (channel === "WHISPER" && isGM && !peer) return toast("Fısıldayacağın oyuncuyu seç.", "error");
    setSending(true);
    const r = await emit("chat", {
      campaignId,
      channel,
      text: t,
      characterId: channel === "IC" && speaker ? speaker.id : null,
      recipientId: channel === "WHISPER" && isGM ? peer : null,
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
    toast(`${d.messages} mesaj${d.rolls ? `, ${d.rolls} zar` : ""} silindi.`, "ok");
    stopSelecting();
  };
  const removeRoll = async (id: string) => {
    const r = await emit("deleteRoll", { campaignId, rollId: id });
    if (!r.ok) toast(r.error, "error");
  };

  const nameOf = (id: string | null) => (id === gm.id ? gm.displayName : (members.find((m) => m.id === id)?.displayName ?? "?"));
  const tabBtn = (t: ChatTab, label: string, n: number) => (
    <button
      key={t}
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={cx("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition", tab === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}
    >
      {label}
      {n > 0 && tab !== t && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-onAccent">{n > 99 ? "99+" : n}</span>}
    </button>
  );
  const charOf = (id: string | null) => myChars.find((c) => c.id === id) ?? null;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div role="tablist" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2 sm:px-4">
        {tabBtn("ic", "Sahne", unread("ic"))}
        {tabBtn("ooc", "Masa", unread("ooc"))}
        {tabBtn("fisilti", "Fısıltılar", whisperUnread)}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            className={cx("flex items-center gap-1 rounded-md px-2 py-1 text-xs", selecting ? "bg-accent/15 text-ink" : "text-muted hover:text-ink")}
            title={isGM ? "Birden çok mesaj ve zar seçip sil" : "Kendi mesajlarından birkaçını seçip sil"}
          >
            <CheckSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{selecting ? "Seçimi bitir" : "Seç"}</span>
          </button>
          {isGM && (
            <button type="button" onClick={() => setClearOpen(true)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-danger" title="Sohbet veya zar geçmişini temizle">
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Temizle</span>
            </button>
          )}
        </span>
      </div>
      {tab === "fisilti" && isGM && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line px-3 py-2 sm:px-5">
          {members.length === 0 && <span className="text-xs text-muted">Kampanyada oyuncu yok.</span>}
          {members.map((m) => {
            const n = unread("fisilti", m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setPeer(m.id)}
                className={cx("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs", peer === m.id ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}
              >
                {m.displayName}
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
              ? "Sahne boş. Karakterinle konuş ya da zar at."
              : tab === "ooc"
                ? "Oyun dışı sohbet burada. Herkes görür."
                : isGM
                  ? peer
                    ? `${nameOf(peer)} ile özel konuşma. Bunu yalnızca ikiniz görürsünüz.`
                    : "Fısıldamak için bir oyuncu seç."
                  : "GM ile özel konuşma. Bunu yalnızca sen ve GM görürsünüz."}
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
                aria-label={on ? "Seçimi kaldır" : "Seç"}
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
          <span className="text-ink">{sel.size} öğe seçildi</span>
          <button
            type="button"
            className="text-xs text-muted hover:text-ink"
            onClick={() => setSel(new Set(view.filter(canSelect).map(keyOfItem)))}
          >
            Görünenlerin tümünü seç
          </button>
          {sel.size > 0 && (
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setSel(new Set())}>
              Temizle
            </button>
          )}
          <span className="ml-auto flex gap-2">
            <Button size="sm" onClick={stopSelecting}>
              Vazgeç
            </Button>
            <Button size="sm" variant="danger" disabled={!sel.size} onClick={removeSelected}>
              <Trash2 className="h-3.5 w-3.5" /> Seçilenleri sil
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
            {spectator ? "İzleyicisin: sahneye yazamazsın. Masa sohbetine ya da GM'e fısıltıyla yazabilirsin." : "Sahnede konuşmak için onaylanmış bir karakterin olmalı. Masa ve Fısıltılar herkese açık."}
          </p>
        )}
        {chatMuted && tab !== "fisilti" && (
          <p className="mb-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">GM seni sohbette susturdu. Yine de GM&apos;e fısıldayabilirsin.</p>
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
                  ? "Anlatıcı olarak yaz…"
                  : speaker
                    ? `${speaker.name} ne söylüyor / yapıyor?`
                    : spectator
                      ? "İzleyiciler sahneye yazamaz"
                      : "Karakterin yok"
                : tab === "ooc"
                  ? "Masaya bir not… (herkes görür)"
                  : isGM
                    ? `${nameOf(peer)} için gizli mesaj…`
                    : "GM'e gizli mesaj…"
            }
            className="input min-h-[44px] resize-none"
          />
          <Button type="submit" variant="primary" className="h-11" disabled={sending || !text.trim() || (chatMuted && tab !== "fisilti") || (tab === "ic" && !isGM && !speaker)}>
            Gönder
          </Button>
        </div>
      </form>
      <Modal open={!!confirmReroll} onClose={() => setConfirmReroll(null)} title={`${pn} harcansın mı?`}>
        {confirmReroll && (
          <div className="space-y-4">
            <p className="text-sm text-ink/90">
              Bu zarı <strong>1 {pn}</strong> harcayarak yeniden atacaksın. Yeni sonuç geçerli olur, eskisi iptal edilir.
            </p>
            <RollCard r={confirmReroll} canReroll={false} onReroll={() => {}} />
            {!isGM && charOf(confirmReroll.characterId) && (
              <p className="text-xs text-muted">
                Kalan {pn}: <span className="font-mono text-ink">{charOf(confirmReroll.characterId)!.inspiration}</span> → <span className="font-mono text-ink">{charOf(confirmReroll.characterId)!.inspiration - 1}</span>
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmReroll(null)}>Vazgeç</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const r = confirmReroll;
                  setConfirmReroll(null);
                  const res = await emit("reroll", { campaignId, rollId: r.id });
                  if (!res.ok) toast(res.error, "error");
                }}
              >
                Harca ve yeniden at
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ClearModal open={clearOpen} onClose={() => setClearOpen(false)} emit={emit} campaignId={campaignId} tab={tab} peer={peer} peerName={nameOf(peer)} />
    </div>
  );
}

type ClearChoice = "IC" | "OOC" | "WHISPER_PEER" | "WHISPER" | "ROLLS" | "ALL";
function ClearModal({ open, onClose, emit, campaignId, tab, peer, peerName }: { open: boolean; onClose: () => void; emit: Emit; campaignId: string; tab: ChatTab; peer: string; peerName: string }) {
  const toast = useToast();
  const [choice, setChoice] = useState<ClearChoice>("IC");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setChoice(tab === "ic" ? "IC" : tab === "ooc" ? "OOC" : "WHISPER_PEER");
  }, [open, tab]);
  const opts: [ClearChoice, string, string][] = [
    ["IC", "Sahne mesajları", "Karakter konuşmaları ve sistem mesajları. Zarlar kalır."],
    ["OOC", "Masa sohbeti", "Oyun dışı sohbetin tamamı."],
    ["WHISPER_PEER", `${peerName} ile fısıltılar`, "Yalnızca bu oyuncuyla olan özel konuşma."],
    ["WHISPER", "Tüm fısıltılar", "Bütün oyuncularla olan özel konuşmalar."],
    ["ROLLS", "Zar geçmişi", "Tüm zar kayıtları. Mesajlar kalır."],
    ["ALL", "Her şey", "Bütün mesajlar, fısıltılar ve zarlar."],
  ];
  return (
    <Modal open={open} onClose={onClose} title="Geçmişi temizle">
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
        <p className="pt-1 text-xs text-muted">Silinenler geri getirilemez. Tek tek silmek için &quot;Seç&quot; düğmesini kullan.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Vazgeç</Button>
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
              toast("Temizlendi.", "ok");
              onClose();
            }}
          >
            Temizle
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function reqSummary(q: RollReq, system: Sys) {
  const bits: string[] = [];
  if (q.kind === "check") bits.push(q.stat ? statLabelOf(system, q.stat) : "Statsız");
  if (q.kind === "decay" && q.decayMode) bits.push(UC_DECAY_MODES[q.decayMode].label);
  if (q.thresholdLabel) bits.push(q.thresholdLabel + (q.thresholdValue == null && q.threshold ? ` (${THRESHOLDS.find((t) => t.key === q.threshold)?.value})` : ""));
  if (q.modifier) bits.push(`durum ${q.modifier > 0 ? "+" : ""}${q.modifier}`);
  if (q.blackMagic) bits.push("kara büyü");
  if (q.magic) bits.push("büyü zarı");
  if (q.decay) bits.push("yoz zar");
  if (q.hidden) bits.push("sonuç gizli");
  return bits.join(" · ");
}

function RequestBar({ requests, isGM, myChars, emit, campaignId, rollMuted }: { requests: RollReq[]; isGM: boolean; myChars: FullChar[]; emit: Emit; campaignId: string; rollMuted: boolean }) {
  const toast = useToast();
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
                  <strong className={q.kind === "death" ? "text-danger" : "text-accent"}>{q.kind === "death" ? "☠ Death Save" : q.kind === "pervitin" ? "Pervitin zarı" : q.kind === "decay" ? "Yozlaşma zarı" : "GM zar istiyor"}:</strong> {q.label}
                </p>
                <p className="text-xs text-muted">{reqSummary(q, system)}</p>
                {isGM && <p className="mt-0.5 text-xs text-muted">Bekleniyor: {q.characters.map((c) => c.name).join(", ")}</p>}
              </div>
              {isGM && (
                <Button size="sm" variant="ghost" onClick={() => emit("cancelRequest", { campaignId, requestId: q.id })}>
                  İptal
                </Button>
              )}
            </div>
            {!isGM && mine.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {q.playerPart && (
                  <select className="input h-8 w-auto py-0 text-xs" value={parts[q.id] ?? ""} onChange={(e) => setParts({ ...parts, [q.id]: e.target.value as BodyPartKey | "" })}>
                    <option value="">Uzuv yok</option>
                    {BODY_PARTS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
                {mine.map((c) => (
                  <Button key={c.id} size="sm" variant={q.kind === "death" ? "danger" : "primary"} disabled={rollMuted || busy} onClick={() => answer(q, c.id)}>
                    {mine.length > 1 ? `${c.name} için at` : q.kind === "death" ? "Death Save at (d6)" : "Zarı at"}
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

function time(s: string) {
  return new Date(s).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function DeleteBtn({ onDelete, title = "Mesajı sil" }: { onDelete: () => void; title?: string }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="ml-2 inline-flex items-center gap-1 text-[11px]">
      <button type="button" className="rounded bg-danger/20 px-1.5 text-danger hover:bg-danger/30" onClick={onDelete}>
        Sil
      </button>
      <button type="button" className="rounded px-1.5 text-muted hover:text-ink" onClick={() => setAsk(false)}>
        Vazgeç
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
  const del = canDelete ? <DeleteBtn onDelete={onDelete} /> : null;
  if (m.channel === "SYSTEM")
    return (
      <div className="group flex items-center justify-center py-1">
        <span className="rounded-full border border-line bg-surface2/60 px-3 py-1 text-center text-xs text-muted">{m.content}</span>
        {del}
      </div>
    );
  if (m.channel === "WHISPER") {
    const mine = m.userId === me;
    return (
      <div className={cx("group flex", mine ? "justify-end" : "justify-start")}>
        <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-sm bg-accent/20" : "rounded-bl-sm border border-line bg-surface2")}>
          <p className="mb-0.5 text-[11px] text-muted">
            {mine ? "Sen" : nameOf(m.userId)} · {time(m.createdAt)}
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
          <span className="font-medium text-ink/80">{m.userName}</span> · {time(m.createdAt)}
          {del}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink/90">{m.content}</p>
      </div>
    );
  return (
    <div className="group rounded-lg px-2 py-1 hover:bg-surface2/30">
      <p className="text-[11px] text-muted">
        <span className="font-serif text-[15px] text-accent">{m.characterName ?? `${m.userName} (anlatıcı)`}</span> · {time(m.createdAt)}
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
  if (r.kind === "death") return <DeathCard r={r} canDelete={canDelete} onDelete={onDelete} />;
  return (
    <div className={cx("group rounded-xl border bg-surface px-3 py-3 sm:px-4", r.rerolled ? "border-line opacity-50" : "border-line", r.hidden && "border-dashed")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">
            {r.characterName ?? r.userName} · {time(r.createdAt)}
            {r.hidden && " · gizli"}
            {r.rerolled && " · yeniden atıldı"}
            {d.requested && " · GM isteği"}
            {d.physical && " · fiziksel zar (GM girdi)"}
            {r.kind === "buyu" && " · büyü zarı"}
            {r.kind === "yoz" && " · yoz zar"}
            {canDelete && onDelete && <DeleteBtn onDelete={onDelete} title="Zarı sil" />}
          </p>
          <p className="font-medium text-ink">{r.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {d.outcome !== "info" && <span className={cx("rounded-md border px-2 py-0.5 text-xs font-semibold", OUTCOME_TONE[d.outcome])}>{outcomeLabel(d.outcome)}</span>}
          <span className="grid h-11 min-w-11 place-items-center rounded-lg bg-surface2 px-2 font-mono text-2xl text-ink">{d.total}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        {d.parts.map((p, i) => (
          <span key={i} className={cx("rounded px-1.5 py-0.5 font-mono", i === 0 ? "bg-accent/15 text-accent" : p.value < 0 ? "bg-danger/10 text-danger" : "bg-surface2 text-ink/80")}>
            {p.label} {i === 0 ? p.value : `${p.value >= 0 ? "+" : ""}${p.value}`}
          </span>
        ))}
        {d.threshold != null && (
          <span className="text-muted">
            ≥ {d.threshold} ({d.thresholdLabel})
          </span>
        )}
      </div>
      {d.note && (r.kind === "pervitin" || r.kind === "decay") && <p className="mt-1.5 text-xs text-ink/80">{d.note}</p>}
      {d.extra && <p className="mt-1.5 rounded-md bg-lav/10 px-2 py-1 text-xs text-ink/85">{d.extra}</p>}
      {canReroll && (
        <button type="button" onClick={onReroll} className="mt-2 text-xs text-accent hover:underline">
          {pointName(system)} harca, yeniden at
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
            {r.characterName ?? r.userName} · {time(r.createdAt)} · Death Save
            {d.physical && " · fiziksel zar"}
            {canDelete && onDelete && <DeleteBtn onDelete={onDelete} title="Zarı sil" />}
          </p>
          <p className={cx("font-serif text-lg", dead ? "text-danger" : "text-ok")}>
            {final === "death" ? "☠ Karakter öldü" : final === "save" ? "✚ Hayatta kaldı" : dead ? "Ölüme bir adım daha…" : "Hayata tutunuyor"}
          </p>
        </div>
        <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-lg font-mono text-2xl", dead ? "bg-danger/20 text-danger" : "bg-ok/20 text-ok")} title="d6: 1–3 ölüm, 4–6 kurtuluş">
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
          <span className="text-muted">d6: 1–3 ölüm · 4–6 kurtuluş</span>
        </div>
      )}
      {d.note && <p className="mt-1.5 text-xs text-ink/85">{d.note}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ zar paneli
function ThresholdPicker({ value, manual, onChange, allowManual }: { value: string | null; manual: number | null; onChange: (key: string | null, manual: number | null) => void; allowManual: boolean }) {
  const { system } = useSys();
  // Umbra Caelis: sabit eşik tablosu yok; eşiği GM sayı olarak koyar (oyuncuya söylemek zorunda değil).
  if (system === "UC")
    return (
      <div>
        <span className="label">Eşik</span>
        {allowManual ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChange(null, null)} className={cx("rounded-md border px-3 py-1.5 text-xs", manual === null ? "border-accent bg-accent/15" : "border-line text-muted")}>
              Yok
            </button>
            <label className={cx("flex flex-1 items-center gap-2 rounded-md border px-2 text-xs", manual !== null ? "border-accent bg-accent/15" : "border-line text-muted")}>
              <span>Sayı</span>
              <input
                type="number"
                min={1}
                max={60}
                inputMode="numeric"
                value={manual ?? ""}
                placeholder="GM belirler"
                data-testid="uc-threshold"
                onChange={(e) => onChange(null, e.target.value === "" ? null : Math.max(1, Math.min(60, Number(e.target.value))))}
                className="h-8 w-full min-w-0 bg-transparent text-center font-mono text-ink outline-none"
              />
            </label>
          </div>
        ) : (
          <p className="rounded-md border border-line bg-surface2/50 px-3 py-1.5 text-xs text-muted">Eşiği GM belirler; sonucu GM değerlendirir.</p>
        )}
      </div>
    );
  return (
    <div>
      <span className="label">Eşik</span>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={() => onChange(null, null)} className={cx("rounded-md border px-1 py-1.5 text-xs", value === null && manual === null ? "border-accent bg-accent/15" : "border-line text-muted")}>
          Yok
        </button>
        {THRESHOLDS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key, null)}
            className={cx("rounded-md border px-1 py-1.5 text-xs", value === t.key && manual === null ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}
          >
            {t.label} <span className="font-mono">{t.value}</span>
          </button>
        ))}
        {allowManual && (
          <label className={cx("flex items-center gap-1 rounded-md border px-1.5 text-xs", manual !== null ? "border-accent bg-accent/15" : "border-line text-muted")}>
            <span>Elle</span>
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
  return (
    <div>
      <span className="label">Stat</span>
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={() => onChange("")} className={cx("rounded-md border px-1 py-1.5 text-xs", value === "" ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink")}>
          Statsız
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
  return (
    <div className="flex items-center justify-between">
      <span className="label mb-0">{label}</span>
      <span className="flex items-center gap-1.5">
        <MiniBtn onClick={() => onChange(Math.max(-20, value - 1))}>−</MiniBtn>
        <span className={cx("w-9 text-center font-mono", value > 0 ? "text-ok" : value < 0 && "text-danger")}>{value > 0 ? `+${value}` : value}</span>
        <MiniBtn onClick={() => onChange(Math.min(20, value + 1))}>+</MiniBtn>
        {value !== 0 && (
          <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => onChange(0)}>
            sıfırla
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
  return (
    <label className="block">
      <span className="label">Masada gelen zar (d{sides})</span>
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
  const thValue = manual ?? (uc ? null : (THRESHOLDS.find((t) => t.key === threshold)?.value ?? null));

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
      <span className="label">{physical ? "Zarı atan" : "Karakter"}</span>
      <select className="input" value={charId} onChange={(e) => setCharId(e.target.value)} data-testid="dice-char">
        {allowNone && <option value="">GM (karaktersiz d20)</option>}
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
            Büyü zarı <span className="text-xs text-muted">(Nat1 → mana geri tepmesi)</span>
          </Check>
          <Check checked={yoz} onChange={setYoz}>
            Yoz zar <span className="text-xs text-muted">(Yozlaşma bonusu, tavana sayılır)</span>
          </Check>
        </>
      ) : (
        <Check checked={bm} onChange={setBm}>
          Kara büyü zarı (Corruption etkileri)
        </Check>
      )}
    </>
  );
  const partSelect = ch && (
    <label className="block">
      <span className="label">Kullanılan uzuv (yara cezası)</span>
      <select className="input" value={part} onChange={(e) => setPart(e.target.value as BodyPartKey | "")}>
        <option value="">Yok</option>
        {BODY_PARTS.map((p) => {
          const pen = woundPenalty(normalizeBody(ch.body)[p.key]);
          return (
            <option key={p.key} value={p.key}>
              {p.label}
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
          {p.value >= 0 ? "+" : "−"} {Math.abs(p.value)} <span className="text-muted">{p.label}</span>
        </span>
      ))}
      <span className="ml-1 font-mono text-ink"> = {first} {sum >= 0 ? "+" : "−"} {Math.abs(sum)}</span>
      {thValue != null && <span className="ml-1 text-muted">≥ {thValue}</span>}
      {ucr && (
        <span className="mt-1 block text-[11px] text-muted">
          Bonus tavanı +{ucr.cap}
          {ucr.overflow > 0 && <span className="text-lav"> · taşan +{ucr.overflow} anlatıma döner</span>}
        </span>
      )}
    </div>
  );

  // ---------------- fiziksel zar modu
  if (physical && !isGM)
    return (
      <div className="space-y-4 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Zar · fiziksel masa</p>
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-3 text-sm" data-testid="physical-player-note">
          <p className="flex items-center gap-2 font-medium text-ink">
            <HandMetal className="h-4 w-4 text-accent" /> Zarlar masada atılıyor
          </p>
          <p className="mt-1 text-ink/85">Zarını gerçek zarla at ve sonucu GM&apos;e söyle. GM sonucu sisteme girer; başarı ve karakterine etkisi Akış&apos;ta görünür.</p>
        </div>
      </div>
    );
  if (physical && isGM) {
    const sides = pkind === "death" ? 6 : 20;
    const needTh = pkind === "corr";
    const canSend = die != null && !busy && (pkind === "check" || !!ch) && (!needTh || thValue != null) && (pkind !== "death" || (deathSaveEnabled && !!ch?.deathSave.available));
    return (
      <div className="space-y-4 p-4" data-testid="physical-gm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Fiziksel zar · sonucu gir</p>
        <p className="text-xs text-muted">Oyuncu zarı masada attı: atan karakteri, zar türünü ve gelen sayıyı seç. Sistem başarıyı ve {decayName(system)} / Death Save etkisini hesaplar.</p>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["check", "Normal zar"],
              ["corr", uc ? "Yozlaşma" : "Pervitin"],
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
              Gizli (yalnızca GM görür)
            </Check>
            <input className="input" placeholder="Açıklama (ör. Kapıyı kır)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
            {preview(die != null ? String(die) : "d20")}
          </>
        )}
        {pkind === "corr" && (
          <>
            {uc && (
              <label className="block">
                <span className="label">Yozlaşma zarı</span>
                <select className="input" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)}>
                  {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                    <option key={k} value={k}>
                      {UC_DECAY_MODES[k].label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted">{UC_DECAY_MODES[dmode].hint}</span>
              </label>
            )}
            {!uc && <p className="text-[11px] text-muted">d20 + Sanita − Corruption/3 + durum ≥ eşik; başarısızlıkta +1 Corruption.</p>}
            <ThresholdPicker value={threshold} manual={manual} allowManual onChange={(k, m) => (setThreshold(k), setManual(m))} />
            <ModifierPicker value={mod} onChange={setMod} label="GM düzenleyici (±)" />
          </>
        )}
        {pkind === "death" && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs">
            d6: 1–3 ölüm, 4–6 kurtuluş. {ch && !ch.deathSave.available && <strong className="text-danger">{ch.name} için Death Save hakkı yok.</strong>}
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
          <HandMetal className="h-5 w-5" /> Sonucu gir
        </Button>
      </div>
    );
  }

  // ---------------- dijital zar
  return (
    <div className="space-y-4 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Zar · d20 + stat{uc ? " + bonus" : ""} ≥ eşik</p>
      {rollMuted && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">GM seni zar atmada susturdu.</p>}
      {!isGM && requests.some((q) => q.characters.some((c) => myChars.some((m) => m.id === c.id))) && (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-ink">GM senden zar istiyor. Akış sekmesinin altındaki isteği yanıtla.</p>
      )}
      {spectator && (
        <p className="flex items-start gap-2 rounded-md border border-line bg-surface2/60 px-3 py-2 text-sm text-muted">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" /> İzleyicisin: zar atamazsın. Atılan zarlar Sahne sekmesinde görünür.
        </p>
      )}
      {choices.length === 0 && !isGM && !spectator && <p className="text-sm text-muted">Zar atmak için onaylanmış bir karakterin olmalı.</p>}
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
              Gizli at (yalnızca GM görür)
            </Check>
          )}
          <input className="input" placeholder="Açıklama (ör. Kapıyı kır)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          {preview("d20")}
          <div className="sticky bottom-0 -mx-4 bg-bg/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0">
            <Button variant="primary" size="lg" className="w-full" disabled={busy || rollMuted || (!ch && !isGM)} onClick={() => doEmit("roll", checkPayload()).then((ok) => ok && setLabel(""))}>
              <Dices className="h-5 w-5" /> Zar at
            </Button>
          </div>
          {isGM && ch && (
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={busy || !deathSaveEnabled || !ch.deathSave.available} onClick={() => doEmit("death", { campaignId, characterId: ch.id })} title={!deathSaveEnabled ? "Kampanyada kapalı" : "GM doğrudan atar"}>
                <Skull className="h-4 w-4" /> Death Save
              </Button>
              {uc ? (
                <Button
                  disabled={busy || thValue == null}
                  onClick={() => doEmit("decay", { campaignId, characterId: ch.id, mode: dmode, thresholdValue: thValue, modifier: mod })}
                  title={thValue == null ? "Önce eşik gir" : UC_DECAY_MODES[dmode].hint}
                >
                  <MoonStar className="h-4 w-4" /> {UC_DECAY_MODES[dmode].label}
                </Button>
              ) : (
                <Button
                  disabled={busy || thValue == null}
                  onClick={() => doEmit("pervitin", { campaignId, characterId: ch.id, threshold: manual === null ? threshold : null, thresholdValue: manual, modifier: mod })}
                  title="d20 + Sanita − Corruption/3 + durum ≥ eşik"
                >
                  Pervitin
                </Button>
              )}
              {uc && (
                <select className="input col-span-2 h-9 py-1 text-xs" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)} aria-label="Yozlaşma zarı türü">
                  {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                    <option key={k} value={k}>
                      Yozlaşma zarı: {UC_DECAY_MODES[k].label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {!isGM && <p className="text-[11px] text-muted">Death Save ve {uc ? "Yozlaşma" : "Pervitin"} zarlarını GM ister; istek gelince Akış&apos;ın altında belirir.</p>}
        </>
      )}
      {isGM && !physical && (
        <div className="border-t border-line pt-4">
          <Button variant="outline" className="w-full" disabled={!allChars.length} onClick={() => setReqOpen(true)}>
            Oyunculardan zar iste
          </Button>
          <RequestModal open={reqOpen} onClose={() => setReqOpen(false)} chars={allChars} emit={emit} campaignId={campaignId} deathSaveEnabled={deathSaveEnabled} />
        </div>
      )}
    </div>
  );
}

function RequestModal({ open, onClose, chars, emit, campaignId, deathSaveEnabled }: { open: boolean; onClose: () => void; chars: FullChar[]; emit: Emit; campaignId: string; deathSaveEnabled: boolean }) {
  const toast = useToast();
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
    <Modal open={open} onClose={onClose} title="Oyunculardan zar iste" wide>
      <div className="space-y-4">
        <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1">
          {(
            [
              ["check", "Normal zar"],
              ["death", "Death Save"],
              uc ? ["decay", "Yozlaşma zarı"] : ["pervitin", "Pervitin"],
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
          <span className="label">Kimler?</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip" onClick={() => setIds(ids.length === eligible.length ? [] : eligible.map((c) => c.id))}>
              {ids.length === eligible.length && eligible.length ? "Hiçbiri" : "Herkes"}
            </button>
            {chars.map((c) => {
              const ok = eligible.includes(c);
              return (
                <label key={c.id} className={cx("chip cursor-pointer", ids.includes(c.id) && "border-accent text-accent", !ok && "opacity-40")} title={!ok ? "Death Save hakkı yok" : undefined}>
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
            <span className="label">Yozlaşma zarı</span>
            <select className="input" value={dmode} onChange={(e) => setDmode(e.target.value as UcDecayMode)}>
              {(Object.keys(UC_DECAY_MODES) as UcDecayMode[]).map((k) => (
                <option key={k} value={k}>
                  {UC_DECAY_MODES[k].label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">{UC_DECAY_MODES[dmode].hint}</span>
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
        {kind === "death" && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">d6 atılır: 1–3 ölüm, 4–6 kurtuluş. Üç ölümde karakter ölür, üç kurtuluşta kritik yaralı hayatta kalır.</p>}
        {kind !== "death" && <ModifierPicker value={mod} onChange={setMod} label={kind === "check" ? (uc ? "Bonus / ceza" : "Durum düzenleyici") : "GM düzenleyici (±)"} />}
        <input className="input" placeholder="Açıklama (ör. Ritüeli gördünüz)" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {kind === "check" && (
            <>
              {uc ? (
                <>
                  <Check checked={magic} onChange={setMagic}>
                    Büyü zarı
                  </Check>
                  <Check checked={yoz} onChange={setYoz}>
                    Yoz zar
                  </Check>
                </>
              ) : (
                <Check checked={bm} onChange={setBm}>
                  Kara büyü zarı
                </Check>
              )}
              <Check checked={playerPart} onChange={setPlayerPart}>
                Oyuncu kullandığı uzvu seçsin
              </Check>
            </>
          )}
          <Check checked={hidden} onChange={setHidden}>
            Sonucu yalnızca ben ve atan görsün
          </Check>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Vazgeç</Button>
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
              toast("Zar isteği gönderildi.", "ok");
              onClose();
              setIds([]);
              setLabel("");
            }}
          >
            İste
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ karakter görünümü (oda içinde)
function CharacterQuick({ entry, data, onClose }: { entry: Entry | null; data: RulesData; onClose: () => void }) {
  const { system, uc } = useSys();
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
                Seviye {c.level} · {c.age} yaş · {c.nationality} · {c.alignment}
              </p>
              {c.status === "DEAD" && <Badge tone="danger">Öldü</Badge>}
              <div className="flex flex-wrap gap-2">
                {c.trees.map((t) =>
                  system === "UC" ? (
                    <span key={t} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
                      K{uc?.dals[t]?.tier} · {uc?.dals[t]?.name ?? t}
                    </span>
                  ) : (
                    <span key={t} className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 py-0.5 pl-0.5 pr-2.5 text-xs text-accent">
                      <TreeIcon treeKey={t} className="h-6 w-6 rounded-full" />
                      {data.trees.find((x) => x.key === t)?.name}
                    </span>
                  ),
                )}
              </div>
              {c.languages?.length > 0 && <p className="text-xs text-muted">Diller: {c.languages.join(", ")}</p>}
              {c.appearance && <p className="text-ink/80">{c.appearance}</p>}
              <AppLink href={characterHref(system, c.id)} target="_blank" className="inline-block text-xs text-accent hover:underline">
                Tam karakter kağıdını yeni sekmede aç ↗
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
            <p className="text-sm text-muted">Diğer oyuncuların karakter kağıtlarının yalnızca bu kısmı görünür.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function QuickFullUc({ c }: { c: FullChar }) {
  const { uc } = useSys();
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
            <span className="text-muted">Yozlaşma:</span> <span className="font-mono">{c.corruption}</span> · <span className="text-muted">Esin:</span> <span className="font-mono">{c.inspiration}</span> ·{" "}
            <span className="text-muted">Bonus tavanı:</span> <span className="font-mono">+{ucBonusCap(c.level)}</span> · <span className="text-muted">Death Save:</span>{" "}
            {c.deathSave.available ? "Var" : "Yok"}
          </p>
          {c.corruption > 0 && <p className="text-xs text-lav">{UC_DECAY_EFFECTS[c.corruption]}</p>}
          {BODY_PARTS.filter((p) => body[p.key].wound !== "saglam").map((p) => (
            <p key={p.key} className="text-danger/90">
              {p.label}: −{woundPenalty(body[p.key])}
            </p>
          ))}
        </div>
      </div>
      {owned.length > 0 && (
        <div>
          <p className="kicker mb-2">Yetenekler</p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {owned.map(([k, lv]) => (
              <li key={k} className="rounded-md border border-line px-3 py-1.5">
                {uc?.abilities[k]?.name ?? k} <span className="font-mono text-xs text-accent">Sv {lv}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.perks.length > 0 && (
        <div>
          <p className="kicker mb-2">Perkler</p>
          <p className="text-sm">{c.perks.map((k) => uc?.perks.find((p) => p.key === k)?.name ?? k).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function QuickFull({ c, data }: { c: FullChar; data: RulesData }) {
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
            <span className="font-mono">{c.inspiration}</span> · <span className="text-muted">Death Save:</span> {c.deathSave.available ? "Var" : "Yok"}
          </p>
          {BODY_PARTS.filter((p) => body[p.key].wound !== "saglam").map((p) => (
            <p key={p.key} className="text-danger/90">
              {p.label}: −{woundPenalty(body[p.key])}
            </p>
          ))}
          {augs.map(({ part, augment }) => (
            <p key={part}>
              <span className="text-accent">{augment.name}</span> <span className="text-muted">({BODY_PARTS.find((b) => b.key === part)?.label})</span>
            </p>
          ))}
        </div>
      </div>
      {c.corruption > 0 && <CorruptionEffects value={c.corruption} />}
      {owned.length > 0 && (
        <div>
          <p className="kicker mb-2">Yetenekler</p>
          <div className="grid gap-2 md:grid-cols-2">{owned.map(([k, lv]) => (data.abilities[k] ? <AbilityCard key={k} ability={data.abilities[k]} level={lv} /> : null))}</div>
        </div>
      )}
      {c.perks.length > 0 && (
        <div>
          <p className="kicker mb-2">Perkler</p>
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
