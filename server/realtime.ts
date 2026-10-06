/**
 * Oyun odası gerçek zamanlı katmanı (Socket.io).
 * Kimlik: oturum çerezi (HttpOnly) el sıkışmada okunur, veritabanından doğrulanır.
 * Zarları HER ZAMAN sunucu atar; istemci yalnızca hangi zarın atılacağını söyler.
 */
import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { db } from "../src/db";
import { campaignMembers, campaigns, characterLogs, characters, messages, rolls, users, type Character, type RollDetail } from "../src/db/schema";
import { SESSION_COOKIE, readCookie, userFromToken, type SessionUser } from "../src/lib/auth/core";
import { BODY_PART_KEYS, CORRUPTION_PERVITIN_IMMUNE, STAT_KEYS, STAT_LABELS, thresholdByKey } from "../src/lib/shz/constants";
import { rulesData } from "../src/lib/shz/content";
import { checkModifiers, clampCorruption, effectiveStats, outcomeFor, outcomeLabel, type CharLike } from "../src/lib/shz/rules";

type Ack = (r: { ok: true; data?: unknown } | { ok: false; error: string }) => void;
interface Data {
  user: SessionUser;
  token: string;
  checkedAt: number;
  campaigns: Map<string, boolean>; // campaignId -> isGM
}
type S = Socket<Record<string, never>, Record<string, never>, Record<string, never>, Data>;

declare global {
  // eslint-disable-next-line no-var
  var __shzIO: Server | undefined;
}

const room = (cid: string) => `c:${cid}`;
const gmRoom = (cid: string) => `g:${cid}`;
const userRoom = (cid: string, uid: string) => `u:${cid}:${uid}`;

const zId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
const zThKey = z.enum(["cok-kolay", "kolay", "orta", "zor", "cok-zor", "uber"]);
const zThreshold = zThKey.nullable();
/** GM'in elle girdiği eşik (hazır kademelerin yerine geçer). */
const zManual = z.number().int().min(1).max(60).nullable().optional();
const schemas = {
  join: z.object({ campaignId: zId }),
  chat: z.object({
    campaignId: zId,
    channel: z.enum(["IC", "OOC", "WHISPER"]),
    text: z.string().trim().min(1).max(2000),
    characterId: zId.nullable().optional(),
    recipientId: zId.nullable().optional(),
  }),
  roll: z.object({
    campaignId: zId,
    characterId: zId.nullable(),
    stat: z.enum(STAT_KEYS).nullable(),
    threshold: zThreshold,
    thresholdValue: zManual,
    part: z.enum(BODY_PART_KEYS as [string, ...string[]]).nullable(),
    modifier: z.number().int().min(-20).max(20),
    blackMagic: z.boolean(),
    label: z.string().trim().max(80),
    hidden: z.boolean(),
    requestId: z.string().max(64).optional(),
  }),
  reroll: z.object({ campaignId: zId, rollId: zId }),
  deleteMessage: z.object({ campaignId: zId, messageId: zId }),
  deleteRoll: z.object({ campaignId: zId, rollId: zId }),
  deleteMany: z.object({ campaignId: zId, messageIds: z.array(zId).max(300).default([]), rollIds: z.array(zId).max(300).default([]) }),
  clearMessages: z.object({ campaignId: zId, scope: z.enum(["IC", "OOC", "WHISPER", "ALL"]), peerId: zId.nullable().optional() }),
  clearRolls: z.object({ campaignId: zId }),
  request: z.object({
    campaignId: zId,
    characterIds: z.array(zId).min(1).max(20),
    kind: z.enum(["check", "death", "pervitin"]).default("check"),
    stat: z.enum(STAT_KEYS).nullable(),
    threshold: zThreshold,
    thresholdValue: zManual,
    modifier: z.number().int().min(-20).max(20).default(0),
    label: z.string().trim().max(80),
    blackMagic: z.boolean(),
    hidden: z.boolean().default(false),
    playerPart: z.boolean().default(false),
  }),
  cancelRequest: z.object({ campaignId: zId, requestId: z.string().max(64) }),
  death: z.object({
    campaignId: zId,
    characterId: zId,
    requestId: z.string().max(64).optional(),
  }),
  pervitin: z.object({
    campaignId: zId,
    characterId: zId,
    threshold: zThKey.nullable().optional(),
    thresholdValue: zManual,
    modifier: z.number().int().min(-20).max(20).optional(),
    requestId: z.string().max(64).optional(),
  }),
};

interface PendingRequest {
  id: string;
  campaignId: string;
  kind: "check" | "death" | "pervitin";
  characters: { id: string; name: string; userId: string }[];
  remaining: string[];
  stat: (typeof STAT_KEYS)[number] | null;
  threshold: string | null;
  thresholdValue: number | null;
  thresholdLabel: string | null;
  modifier: number;
  label: string;
  blackMagic: boolean;
  hidden: boolean;
  playerPart: boolean;
  createdAt: string;
}
/** Bekleyen GM zar istekleri (bellekte; sunucu yeniden başlarsa düşer). */
const pending: Map<string, Map<string, PendingRequest>> = ((globalThis as { __shzPending?: Map<string, Map<string, PendingRequest>> }).__shzPending ??= new Map());
function campaignRequests(cid: string) {
  let m = pending.get(cid);
  if (!m) pending.set(cid, (m = new Map()));
  return m;
}
const publicRequest = (r: PendingRequest) => {
  const { remaining, ...rest } = r;
  return {
    ...rest,
    characters: r.characters.filter((c) => remaining.includes(c.id)),
  };
};

/** Hazır eşik kademesi ya da (yalnızca GM için) elle girilen eşik. */
function resolveThreshold(key: string | null | undefined, manual: number | null | undefined, allowManual: boolean) {
  if (allowManual && manual != null) return { value: manual, label: `Eşik ${manual}` };
  const t = key ? thresholdByKey(key) : null;
  return t ? { value: t.value, label: t.label } : null;
}

// ---------------------------------------------------------------- yardımcılar
const presence = new Map<string, Map<string, number>>();
function setPresence(cid: string, uid: string, delta: number) {
  const m = presence.get(cid) ?? new Map<string, number>();
  const n = (m.get(uid) ?? 0) + delta;
  if (n <= 0) m.delete(uid);
  else m.set(uid, n);
  presence.set(cid, m);
  return [...m.keys()];
}

const buckets = new Map<string, { n: number; reset: number }>();
function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  return ++b.n <= max;
}

function asCharLike(c: Character): CharLike {
  return {
    level: c.level,
    stats: c.stats,
    trees: c.trees,
    abilities: c.abilities,
    perks: c.perks,
    body: c.body,
    corruption: c.corruption,
    inspiration: c.inspiration,
    abilityPoints: c.abilityPoints,
  };
}

class UserError extends Error {}
const fail = (m: string) => {
  throw new UserError(m);
};

function guard<T>(schema: z.ZodType<T>, fn: (s: S, input: T) => Promise<unknown>, limit = { max: 20, ms: 10_000 }) {
  return (s: S, raw: unknown, ack?: Ack) => {
    const cb: Ack = typeof ack === "function" ? ack : () => {};
    if (!allow(`${s.data.user.id}:${fn.name}`, limit.max, limit.ms)) return cb({ ok: false, error: "Çok hızlı. Biraz bekle." });
    const r = schema.safeParse(raw);
    if (!r.success) return cb({ ok: false, error: "Geçersiz istek." });
    revalidate(s)
      .then((alive) => {
        if (!alive) throw new UserError("Oturum sona erdi.");
        return fn(s, r.data);
      })
      .then((data) => cb({ ok: true, data }))
      .catch((e) => {
        if (e instanceof UserError) cb({ ok: false, error: e.message });
        else {
          console.error("[socket]", fn.name, e);
          cb({ ok: false, error: "Sunucu hatası." });
        }
      });
  };
}

/** Oturumu ve kampanya üyeliklerini en fazla dakikada bir yeniden doğrular. */
async function revalidate(s: S): Promise<boolean> {
  if (Date.now() - s.data.checkedAt < 60_000) return true;
  s.data.checkedAt = Date.now();
  const u = await userFromToken(s.data.token);
  if (!u) {
    s.disconnect(true);
    return false;
  }
  s.data.user = u;
  for (const [cid] of s.data.campaigns) {
    const c = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, cid),
      columns: { gmId: true },
    });
    const isGM = c?.gmId === u.id;
    const member =
      isGM ||
      (!!c &&
        !!(await db.query.campaignMembers.findFirst({
          where: and(eq(campaignMembers.campaignId, cid), eq(campaignMembers.userId, u.id)),
        })));
    if (!member) {
      s.data.campaigns.delete(cid);
      await Promise.all([s.leave(room(cid)), s.leave(gmRoom(cid)), s.leave(userRoom(cid, u.id))]);
    } else s.data.campaigns.set(cid, isGM);
  }
  return true;
}

/** GM susturmaları: GM'in kendisi asla susturulmaz. */
/** GM susturmaları ve izleyici kısıtları (her istekte veritabanından okunur, rol değişikliği anında geçerli). */
async function assertNotMuted(s: S, cid: string, isGM: boolean, kind: "chat" | "ic" | "roll") {
  if (isGM) return;
  const m = await db.query.campaignMembers.findFirst({
    where: and(eq(campaignMembers.campaignId, cid), eq(campaignMembers.userId, s.data.user.id)),
    columns: { chatMuted: true, rollMuted: true, role: true },
  });
  if (m?.role === "SPECTATOR") {
    if (kind === "roll") fail("İzleyiciler zar atamaz.");
    if (kind === "ic") fail("İzleyiciler sahneye yazamaz.");
  }
  if ((kind === "chat" || kind === "ic") && m?.chatMuted) fail("GM seni sohbette susturdu.");
  if (kind === "roll" && m?.rollMuted) fail("GM seni zar atmada susturdu.");
}

function joined(s: S, cid: string) {
  const isGM = s.data.campaigns.get(cid);
  if (isGM === undefined) fail("Önce odaya katıl.");
  return isGM as boolean;
}

async function loadChar(cid: string, characterId: string) {
  const c = await db.query.characters.findFirst({
    where: and(eq(characters.id, characterId), eq(characters.campaignId, cid)),
  });
  if (!c) fail("Karakter bulunamadı.");
  return c as Character;
}

function rollView(r: typeof rolls.$inferSelect, userName: string | null, charName: string | null) {
  return { ...r, userName, characterName: charName };
}

async function emitRoll(io: Server, cid: string, r: typeof rolls.$inferSelect, user: SessionUser, charName: string | null) {
  const v = rollView(r, user.displayName, charName);
  if (r.hidden) {
    io.to(gmRoom(cid)).emit("roll", v);
    io.to(userRoom(cid, user.id)).emit("roll", v);
  } else io.to(room(cid)).emit("roll", v);
}

async function systemMessage(io: Server, cid: string, user: SessionUser, content: string) {
  const [m] = await db.insert(messages).values({ campaignId: cid, userId: user.id, channel: "SYSTEM", content }).returning();
  io.to(room(cid)).emit("message", {
    ...m,
    userName: user.displayName,
    characterName: null,
  });
}

/** Death Save / Pervitin: oyuncular yalnızca GM isteğiyle atar; GM her zaman atabilir. */
function takeRequest(cid: string, requestId: string | undefined, kind: PendingRequest["kind"], characterId: string, isGM: boolean) {
  const req = requestId ? (campaignRequests(cid).get(requestId) ?? null) : null;
  if (requestId && (!req || req.kind !== kind || !req.remaining.includes(characterId))) fail("Bu zar isteği artık geçerli değil.");
  if (!req && !isGM) fail(kind === "death" ? "Death Save zarını yalnızca GM isteyebilir." : "Pervitin zarını yalnızca GM isteyebilir.");
  return { req, release: req ? claim(req, characterId) : () => {} };
}

let settleRequest: (cid: string, req: PendingRequest) => void = () => {};

/** İsteği bu karakter için hemen "kullanıldı" say (eşzamanlı ikinci yanıtı engeller). */
function claim(req: PendingRequest, characterId: string) {
  req.remaining = req.remaining.filter((x) => x !== characterId);
  return () => {
    if (!req.remaining.includes(characterId)) req.remaining.push(characterId);
  };
}

// ---------------------------------------------------------------- işleyiciler
export function attachRealtime(io: Server) {
  globalThis.__shzIO = io;
  // GM odayı kapatınca (API): bekleyen zar isteklerini, varlık bilgisini ve soketlerin oda üyeliğini temizle.
  globalThis.__shzCloseRoom = (cid) => {
    pending.delete(cid);
    presence.delete(cid);
    const ns = io.of("/");
    for (const sid of [...(ns.adapter.rooms.get(room(cid)) ?? [])]) {
      const sock = ns.sockets.get(sid) as S | undefined;
      if (!sock) continue;
      sock.data.campaigns.delete(cid);
      void Promise.all([sock.leave(room(cid)), sock.leave(gmRoom(cid)), sock.leave(userRoom(cid, sock.data.user.id))]);
    }
  };
  settleRequest = (cid, req) => {
    if (campaignRequests(cid).get(req.id) !== req) return; // bu sırada iptal edildi
    if (!req.remaining.length) {
      campaignRequests(cid).delete(req.id);
      io.to(room(cid)).emit("roll:request:done", { id: req.id });
    } else io.to(room(cid)).emit("roll:request", publicRequest(req));
  };

  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      const allowed = process.env.APP_ORIGIN?.replace(/\/+$/, "");
      if (process.env.NODE_ENV === "production" && (!origin || origin !== allowed)) return next(new Error("origin"));
      const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
      const user = await userFromToken(token);
      if (!user) return next(new Error("auth"));
      (socket as S).data = {
        user,
        token: token!,
        checkedAt: Date.now(),
        campaigns: new Map(),
      };
      next();
    } catch (e) {
      console.error("[socket auth]", e);
      next(new Error("auth"));
    }
  });

  io.on("connection", (raw) => {
    const s = raw as S;
    // Hesap kapatma / üyelikten çıkarma / tüm oturumları kapatma bu odaya gönderilir.
    void s.join(`user:${s.data.user.id}`);
    const handlers = {
      join: guard(schemas.join, async function join(s, { campaignId }) {
        const c = await db.query.campaigns.findFirst({
          where: eq(campaigns.id, campaignId),
        });
        if (!c) fail("Kampanya bulunamadı.");
        const isGM = c!.gmId === s.data.user.id;
        if (!isGM) {
          const m = await db.query.campaignMembers.findFirst({
            where: and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, s.data.user.id)),
          });
          if (!m) fail("Kampanya bulunamadı.");
        }
        if (!s.data.campaigns.has(campaignId)) {
          s.data.campaigns.set(campaignId, isGM);
          await s.join([room(campaignId), userRoom(campaignId, s.data.user.id), ...(isGM ? [gmRoom(campaignId)] : [])]);
          io.to(room(campaignId)).emit("presence", {
            campaignId,
            online: setPresence(campaignId, s.data.user.id, 1),
          });
        }
        const uid = s.data.user.id;
        const msgRows = await db
          .select({
            m: messages,
            userName: users.displayName,
            charName: characters.name,
          })
          .from(messages)
          .leftJoin(users, eq(users.id, messages.userId))
          .leftJoin(characters, eq(characters.id, messages.characterId))
          .where(and(eq(messages.campaignId, campaignId), isGM ? undefined : or(inArray(messages.channel, ["IC", "OOC", "SYSTEM"]), eq(messages.userId, uid), eq(messages.recipientId, uid))))
          .orderBy(desc(messages.createdAt))
          .limit(150);
        const rollRows = await db
          .select({
            r: rolls,
            userName: users.displayName,
            charName: characters.name,
          })
          .from(rolls)
          .leftJoin(users, eq(users.id, rolls.userId))
          .leftJoin(characters, eq(characters.id, rolls.characterId))
          .where(and(eq(rolls.campaignId, campaignId), isGM ? undefined : or(eq(rolls.hidden, false), eq(rolls.userId, uid))))
          .orderBy(desc(rolls.createdAt))
          .limit(100);
        return {
          isGM,
          requests: [...campaignRequests(campaignId).values()].map(publicRequest),
          online: [...(presence.get(campaignId)?.keys() ?? [])],
          messages: msgRows.reverse().map((x) => ({
            ...x.m,
            userName: x.userName,
            characterName: x.charName,
          })),
          rolls: rollRows.reverse().map((x) => rollView(x.r, x.userName, x.charName)),
        };
      }),

      chat: guard(
        schemas.chat,
        async function chat(s, p) {
          const isGM = joined(s, p.campaignId);
          // Susturulan oyuncu yine de GM'e fısıldayabilir.
          if (p.channel !== "WHISPER") await assertNotMuted(s, p.campaignId, isGM, p.channel === "IC" ? "ic" : "chat");
          const uid = s.data.user.id;
          let characterId: string | null = null;
          let charName: string | null = null;
          if (p.characterId) {
            const c = await loadChar(p.campaignId, p.characterId);
            if (!isGM && (c.userId !== uid || c.status !== "ACTIVE")) fail("Bu karakter adına konuşamazsın.");
            characterId = c.id;
            charName = c.name;
          }
          let recipientId: string | null = null;
          const camp = await db.query.campaigns.findFirst({
            where: eq(campaigns.id, p.campaignId),
          });
          if (p.channel === "WHISPER") {
            if (isGM) {
              if (!p.recipientId) fail("Kime fısıldayacağını seç.");
              const m = await db.query.campaignMembers.findFirst({
                where: and(eq(campaignMembers.campaignId, p.campaignId), eq(campaignMembers.userId, p.recipientId!)),
              });
              if (!m) fail("Alıcı bu kampanyada değil.");
              recipientId = p.recipientId!;
            } else recipientId = camp!.gmId; // oyuncular yalnızca GM'e fısıldar
          }
          const [m] = await db
            .insert(messages)
            .values({
              campaignId: p.campaignId,
              userId: uid,
              characterId,
              recipientId,
              channel: p.channel,
              content: p.text,
            })
            .returning();
          const view = {
            ...m,
            userName: s.data.user.displayName,
            characterName: charName,
          };
          if (p.channel === "WHISPER") {
            io.to(userRoom(p.campaignId, recipientId!)).emit("message", view);
            io.to(userRoom(p.campaignId, uid)).emit("message", view);
            io.to(gmRoom(p.campaignId)).except(userRoom(p.campaignId, recipientId!)).emit("message", view);
          } else io.to(room(p.campaignId)).emit("message", view);
        },
        { max: 12, ms: 10_000 },
      ),

      delete: guard(
        schemas.deleteMessage,
        async function deleteMessage(s, p) {
          const isGM = joined(s, p.campaignId);
          const m = await db.query.messages.findFirst({
            where: and(eq(messages.id, p.messageId), eq(messages.campaignId, p.campaignId)),
          });
          if (!m) fail("Mesaj bulunamadı.");
          if (!isGM && m!.userId !== s.data.user.id) fail("Yalnızca kendi mesajını silebilirsin.");
          await db.delete(messages).where(eq(messages.id, m!.id));
          io.to(room(p.campaignId)).emit("message:deleted", { id: m!.id });
        },
        { max: 30, ms: 10_000 },
      ),

      deleteMany: guard(
        schemas.deleteMany,
        async function deleteMany(s, p) {
          const isGM = joined(s, p.campaignId);
          if (!p.messageIds.length && !p.rollIds.length) return { messages: 0, rolls: 0 };
          if (!isGM && p.rollIds.length) fail("Zarları yalnızca GM silebilir.");
          const mWhere = and(
            eq(messages.campaignId, p.campaignId),
            inArray(messages.id, p.messageIds.length ? p.messageIds : ["-"]),
            isGM ? undefined : eq(messages.userId, s.data.user.id),
          );
          const dm = p.messageIds.length ? await db.delete(messages).where(mWhere).returning({ id: messages.id }) : [];
          const dr = p.rollIds.length
            ? await db
                .delete(rolls)
                .where(and(eq(rolls.campaignId, p.campaignId), inArray(rolls.id, p.rollIds)))
                .returning({ id: rolls.id })
            : [];
          if (dm.length || dr.length) io.to(room(p.campaignId)).emit("feed:deleted", { messageIds: dm.map((x) => x.id), rollIds: dr.map((x) => x.id) });
          return { messages: dm.length, rolls: dr.length };
        },
        { max: 10, ms: 10_000 },
      ),

      clearMessages: guard(
        schemas.clearMessages,
        async function clearMessages(s, p) {
          if (!joined(s, p.campaignId)) fail("Sohbet geçmişini yalnızca GM temizleyebilir.");
          const scope =
            p.scope === "ALL"
              ? undefined
              : p.scope === "IC"
                ? inArray(messages.channel, ["IC", "SYSTEM"])
                : p.scope === "OOC"
                  ? eq(messages.channel, "OOC")
                  : and(eq(messages.channel, "WHISPER"), p.peerId ? or(eq(messages.userId, p.peerId), eq(messages.recipientId, p.peerId)) : undefined);
          await db.delete(messages).where(and(eq(messages.campaignId, p.campaignId), scope));
          io.to(room(p.campaignId)).emit("messages:cleared", { scope: p.scope, peerId: p.peerId ?? null });
          const label = { IC: "sahne", OOC: "masa", WHISPER: "fısıltı", ALL: "tüm sohbet" }[p.scope];
          if (p.scope !== "WHISPER") await systemMessage(io, p.campaignId, s.data.user, `GM ${label} geçmişini temizledi.`);
        },
        { max: 5, ms: 10_000 },
      ),

      roll: guard(schemas.roll, async function roll(s, p) {
        const isGM = joined(s, p.campaignId);
        await assertNotMuted(s, p.campaignId, isGM, "roll");
        const data = rulesData();
        // GM isteğine yanıt: parametreleri istemciden değil istekten al.
        let req: PendingRequest | null = null;
        if (p.requestId) {
          req = campaignRequests(p.campaignId).get(p.requestId) ?? null;
          if (!req || req.kind !== "check") fail("Bu zar isteği artık geçerli değil.");
          if (!p.characterId || !req!.remaining.includes(p.characterId)) fail("Bu istek bu karakter için değil.");
        }
        const release = req ? claim(req, p.characterId!) : () => {};
        try {
          const stat = req ? req.stat : p.stat;
          const th = req
            ? req.thresholdValue != null
              ? {
                  value: req.thresholdValue,
                  label: req.thresholdLabel ?? `Eşik ${req.thresholdValue}`,
                }
              : resolveThreshold(req.threshold, null, false)
            : resolveThreshold(p.threshold, p.thresholdValue, isGM);
          const modifier = req ? req.modifier : p.modifier;
          const blackMagic = req ? req.blackMagic : p.blackMagic;
          const part = req && !req.playerPart ? null : p.part;
          const d20 = randomInt(1, 21);
          let parts: { label: string; value: number }[] = [];
          let charName: string | null = null;
          if (p.characterId) {
            const c = await loadChar(p.campaignId, p.characterId);
            if (!isGM && (c.userId !== s.data.user.id || c.status !== "ACTIVE")) fail("Bu karakter için zar atamazsın.");
            parts = checkModifiers(asCharLike(c), { stat, part: part as never, modifier, blackMagic }, data);
            charName = c.name;
          } else {
            if (!isGM) fail("Bir karakter seçmelisin.");
            if (modifier) parts.push({ label: "Düzenleyici", value: modifier });
          }
          const total = d20 + parts.reduce((a, b) => a + b.value, 0);
          const outcome = outcomeFor(d20, total, th?.value ?? null);
          const label = (req ? req.label : p.label) || (stat ? `${STAT_LABELS[stat]} zarı` : "d20");
          const detail: RollDetail = {
            parts: [{ label: "d20", value: d20 }, ...parts],
            total,
            threshold: th?.value ?? null,
            thresholdLabel: th?.label ?? null,
            outcome,
            ...(req ? { requestId: req.id, requested: true } : {}),
            note: JSON.stringify({
              stat,
              part,
              modifier,
              blackMagic,
              threshold: th?.value ?? null,
              thresholdLabel: th?.label ?? null,
            }),
          };
          const [r] = await db
            .insert(rolls)
            .values({
              campaignId: p.campaignId,
              userId: s.data.user.id,
              characterId: p.characterId,
              kind: blackMagic ? "kara-buyu" : "check",
              label,
              dice: [d20],
              detail,
              hidden: req ? req.hidden : isGM && p.hidden,
            })
            .returning();
          await emitRoll(io, p.campaignId, r, s.data.user, charName);
          if (req) settleRequest(p.campaignId, req);
          return { id: r.id, total, outcome: outcomeLabel(outcome) };
        } catch (e) {
          release();
          throw e;
        }
      }),

      reroll: guard(schemas.reroll, async function reroll(s, p) {
        const isGM = joined(s, p.campaignId);
        await assertNotMuted(s, p.campaignId, isGM, "roll");
        const orig = await db.query.rolls.findFirst({
          where: and(eq(rolls.id, p.rollId), eq(rolls.campaignId, p.campaignId)),
        });
        if (!orig || !orig.characterId || orig.kind === "death" || orig.kind === "pervitin") fail("Bu zar yeniden atılamaz.");
        if (orig!.rerolled) fail("Bu zar zaten yeniden atıldı.");
        const c = await loadChar(p.campaignId, orig!.characterId!);
        if (!isGM && (c.userId !== s.data.user.id || c.status !== "ACTIVE")) fail("Bu zar senin değil.");
        if (c.inspiration < 1) fail("Inspiration puanın yok.");
        const prm = JSON.parse(orig!.detail.note ?? "{}");
        const upd = await db
          .update(characters)
          .set({ inspiration: c.inspiration - 1 })
          .where(and(eq(characters.id, c.id), eq(characters.inspiration, c.inspiration)))
          .returning({ id: characters.id });
        if (!upd.length) fail("Tekrar dene.");
        const marked = await db
          .update(rolls)
          .set({ rerolled: true })
          .where(and(eq(rolls.id, orig!.id), eq(rolls.rerolled, false)))
          .returning({ id: rolls.id });
        if (!marked.length) fail("Bu zar zaten yeniden atıldı.");
        const fresh = { ...c, inspiration: c.inspiration - 1 };
        const data = rulesData();
        const parts = checkModifiers(
          asCharLike(fresh),
          {
            stat: prm.stat ?? null,
            part: prm.part ?? null,
            modifier: prm.modifier ?? 0,
            blackMagic: !!prm.blackMagic,
          },
          data,
        );
        const d20 = randomInt(1, 21);
        const total = d20 + parts.reduce((a, b) => a + b.value, 0);
        const detail: RollDetail = {
          parts: [{ label: "d20", value: d20 }, ...parts],
          total,
          threshold: orig!.detail.threshold,
          thresholdLabel: orig!.detail.thresholdLabel,
          outcome: outcomeFor(d20, total, orig!.detail.threshold),
          rerollOf: orig!.id,
          note: orig!.detail.note,
        };
        const [r] = await db
          .insert(rolls)
          .values({
            campaignId: p.campaignId,
            userId: s.data.user.id,
            characterId: c.id,
            kind: orig!.kind,
            label: `${orig!.label} (Inspiration)`,
            dice: [d20],
            detail,
            hidden: orig!.hidden,
          })
          .returning();
        await db.insert(characterLogs).values({
          characterId: c.id,
          actorId: s.data.user.id,
          kind: "inspiration",
          text: `Inspiration harcandı: "${orig!.label}" yeniden atıldı.`,
        });
        io.to(room(p.campaignId)).emit("roll:rerolled", { id: orig!.id });
        await emitRoll(io, p.campaignId, r, s.data.user, c.name);
        io.to(room(p.campaignId)).emit("character:changed", {
          characterId: c.id,
        });
        return { id: r.id };
      }),

      deleteRoll: guard(
        schemas.deleteRoll,
        async function deleteRoll(s, p) {
          if (!joined(s, p.campaignId)) fail("Zarları yalnızca GM silebilir.");
          const del = await db
            .delete(rolls)
            .where(and(eq(rolls.id, p.rollId), eq(rolls.campaignId, p.campaignId)))
            .returning({ id: rolls.id });
          if (!del.length) fail("Zar bulunamadı.");
          io.to(room(p.campaignId)).emit("roll:deleted", { id: p.rollId });
        },
        { max: 40, ms: 10_000 },
      ),

      clearRolls: guard(
        schemas.clearRolls,
        async function clearRolls(s, p) {
          if (!joined(s, p.campaignId)) fail("Zar geçmişini yalnızca GM temizleyebilir.");
          await db.delete(rolls).where(eq(rolls.campaignId, p.campaignId));
          io.to(room(p.campaignId)).emit("rolls:cleared", {});
          await systemMessage(io, p.campaignId, s.data.user, "GM zar geçmişini temizledi.");
        },
        { max: 3, ms: 10_000 },
      ),

      request: guard(schemas.request, async function request(s, p) {
        if (!joined(s, p.campaignId)) fail("Zar isteğini yalnızca GM gönderebilir.");
        const th = p.kind === "death" ? null : resolveThreshold(p.threshold, p.thresholdValue, true);
        if (p.kind === "pervitin" && !th) fail("Pervitin zarı için bir eşik seç.");
        if (p.kind === "death") {
          const camp = await db.query.campaigns.findFirst({
            where: eq(campaigns.id, p.campaignId),
            columns: { deathSaveEnabled: true },
          });
          if (!camp?.deathSaveEnabled) fail("Bu kampanyada Death Save kapalı.");
        }
        const rows = await db
          .select({
            id: characters.id,
            name: characters.name,
            userId: characters.userId,
            deathSave: characters.deathSave,
          })
          .from(characters)
          .where(and(eq(characters.campaignId, p.campaignId), inArray(characters.id, p.characterIds), eq(characters.status, "ACTIVE")));
        const spect = new Set(
          (
            await db
              .select({ u: campaignMembers.userId })
              .from(campaignMembers)
              .where(and(eq(campaignMembers.campaignId, p.campaignId), eq(campaignMembers.role, "SPECTATOR")))
          ).map((x) => x.u),
        );
        const chars = rows
          .filter((c) => (p.kind !== "death" || c.deathSave.available) && !spect.has(c.userId))
          .map(({ id, name, userId }) => ({ id, name, userId }));
        if (!chars.length) fail(p.kind === "death" ? "Seçilen karakterlerin Death Save hakkı yok." : "Seçilen karakterler aktif değil.");
        const label = p.label || (p.kind === "death" ? "Death Save" : p.kind === "pervitin" ? "Pervitin zarı" : p.stat ? `${STAT_LABELS[p.stat]} zarı` : "Zar");
        const req: PendingRequest = {
          id: randomUUID(),
          campaignId: p.campaignId,
          kind: p.kind,
          characters: chars,
          remaining: chars.map((c) => c.id),
          stat: p.kind === "check" ? p.stat : null,
          threshold: p.thresholdValue != null ? null : p.threshold,
          thresholdValue: p.thresholdValue ?? null,
          thresholdLabel: th?.label ?? null,
          modifier: p.modifier,
          label,
          blackMagic: p.kind === "check" && p.blackMagic,
          hidden: p.hidden,
          playerPart: p.kind === "check" && p.playerPart,
          createdAt: new Date().toISOString(),
        };
        campaignRequests(p.campaignId).set(req.id, req);
        io.to(room(p.campaignId)).emit("roll:request", publicRequest(req));
        const bits = [
          th ? `${th.label}${p.thresholdValue == null ? "" : ""}` : null,
          p.modifier ? `durum ${p.modifier > 0 ? "+" : ""}${p.modifier}` : null,
          p.hidden ? "sonuç gizli" : null,
        ].filter(Boolean);
        await systemMessage(io, p.campaignId, s.data.user, `GM zar istedi: ${label}${bits.length ? ` (${bits.join(", ")})` : ""} → ${chars.map((c) => c.name).join(", ")}`);
        return { id: req.id };
      }),

      cancelRequest: guard(schemas.cancelRequest, async function cancelRequest(s, p) {
        if (!joined(s, p.campaignId)) fail("Yalnızca GM.");
        campaignRequests(p.campaignId).delete(p.requestId);
        io.to(room(p.campaignId)).emit("roll:request:done", {
          id: p.requestId,
        });
      }),

      death: guard(schemas.death, async function death(s, p) {
        const isGM = joined(s, p.campaignId);
        await assertNotMuted(s, p.campaignId, isGM, "roll");
        const camp = await db.query.campaigns.findFirst({
          where: eq(campaigns.id, p.campaignId),
        });
        if (!camp!.deathSaveEnabled) fail("Bu kampanyada Death Save kapalı.");
        const { req, release } = takeRequest(p.campaignId, p.requestId, "death", p.characterId, isGM);
        try {
          const c = await loadChar(p.campaignId, p.characterId);
          if (!isGM && (c.userId !== s.data.user.id || c.status !== "ACTIVE")) fail("Bu karakter senin değil.");
          if (c.status === "DEAD") fail("Karakter zaten ölü.");
          const ds = { ...c.deathSave };
          if (!ds.available) fail("Death Save hakkı yok. Inspiration ile yenilenmeli.");
          const d6 = randomInt(1, 7);
          const isDeath = d6 <= 3;
          if (isDeath) ds.deaths++;
          else ds.saves++;
          const track = {
            deaths: ds.deaths,
            saves: ds.saves,
            final: null as "death" | "save" | null,
          };
          let note = isDeath ? `Ölüme bir adım daha yaklaştı. Ölüm ${ds.deaths}/3 · Kurtuluş ${ds.saves}/3` : `Hayata tutundu. Ölüm ${ds.deaths}/3 · Kurtuluş ${ds.saves}/3`;
          if (ds.deaths >= 3 || ds.saves >= 3) {
            track.final = ds.deaths >= 3 ? "death" : "save";
            note = track.final === "death" ? `${c.name} öldü.` : `${c.name} kritik yaralı olarak hayatta kaldı.`;
            ds.available = false;
            ds.deaths = 0;
            ds.saves = 0;
          }
          const upd = await db
            .update(characters)
            .set({
              deathSave: ds,
              ...(track.final === "death" ? { status: "DEAD" as const } : {}),
            })
            .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
            .returning({ id: characters.id });
          if (!upd.length) fail("Karakter bu sırada değişti, tekrar dene.");
          const detail: RollDetail = {
            parts: [{ label: "d6", value: d6 }],
            total: d6,
            threshold: 4,
            thresholdLabel: "1–3 ölüm · 4–6 kurtuluş",
            outcome: isDeath ? "death" : "save",
            note,
            deathTrack: track,
            ...(req ? { requestId: req.id, requested: true } : {}),
          };
          const [r] = await db
            .insert(rolls)
            .values({
              campaignId: p.campaignId,
              userId: s.data.user.id,
              characterId: c.id,
              kind: "death",
              label: "Death Save",
              dice: [d6],
              detail,
              hidden: req?.hidden ?? false,
            })
            .returning();
          if (track.final)
            await db.insert(characterLogs).values({
              characterId: c.id,
              actorId: s.data.user.id,
              kind: "death-save",
              text: `Death Save sonucu: ${note}`,
            });
          await emitRoll(io, p.campaignId, r, s.data.user, c.name);
          if (req) settleRequest(p.campaignId, req);
          if (track.final === "death") await systemMessage(io, p.campaignId, s.data.user, `☠ ${c.name} Death Save'i kaybetti ve öldü.`);
          io.to(room(p.campaignId)).emit("character:changed", {
            characterId: c.id,
          });
        } catch (e) {
          release();
          throw e;
        }
      }),

      pervitin: guard(schemas.pervitin, async function pervitin(s, p) {
        const isGM = joined(s, p.campaignId);
        await assertNotMuted(s, p.campaignId, isGM, "roll");
        const { req, release } = takeRequest(p.campaignId, p.requestId, "pervitin", p.characterId, isGM);
        try {
          const c = await loadChar(p.campaignId, p.characterId);
          if (!isGM && (c.userId !== s.data.user.id || c.status !== "ACTIVE")) fail("Bu karakter senin değil.");
          const th = req
            ? req.thresholdValue != null
              ? {
                  value: req.thresholdValue,
                  label: req.thresholdLabel ?? `Eşik ${req.thresholdValue}`,
                }
              : resolveThreshold(req.threshold, null, false)
            : resolveThreshold(p.threshold ?? null, p.thresholdValue, isGM);
          if (!th) fail("Pervitin zarı için eşik gerekli.");
          const modifier = req ? req.modifier : isGM ? (p.modifier ?? 0) : 0;
          const data = rulesData();
          const eff = effectiveStats(asCharLike(c), data);
          const d20 = randomInt(1, 21);
          const parts = [
            { label: "d20", value: d20 },
            { label: "Sanita", value: eff.sanita.value },
            { label: "Corruption / 3", value: -Math.floor(c.corruption / 3) },
            ...(modifier ? [{ label: "GM durum", value: modifier }] : []),
          ];
          const total = parts.reduce((a, b) => a + b.value, 0);
          let note: string;
          let outcome: RollDetail["outcome"];
          if (c.corruption >= CORRUPTION_PERVITIN_IMMUNE) {
            note = "Corruption 10+: Pervitin artık Corruption'ı etkilemez.";
            outcome = "info";
          } else if (total >= th!.value) {
            note = "Corruption artmadı.";
            outcome = "success";
          } else {
            const next = clampCorruption(c.corruption + 1, c.corruptionLocked);
            const upd = await db
              .update(characters)
              .set({ corruption: next.value, corruptionLocked: next.locked })
              .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
              .returning({ id: characters.id });
            if (!upd.length) fail("Karakter bu sırada değişti, tekrar dene.");
            await db.insert(characterLogs).values({
              characterId: c.id,
              actorId: s.data.user.id,
              kind: "corruption",
              text: `Pervitin: Corruption ${c.corruption} → ${next.value}`,
            });
            note = `Corruption ${c.corruption} → ${next.value}`;
            outcome = "fail";
          }
          const detail: RollDetail = {
            parts,
            total,
            threshold: th!.value,
            thresholdLabel: th!.label,
            outcome,
            note,
            ...(req ? { requestId: req.id, requested: true } : {}),
          };
          const [r] = await db
            .insert(rolls)
            .values({
              campaignId: p.campaignId,
              userId: s.data.user.id,
              characterId: c.id,
              kind: "pervitin",
              label: "Pervitin",
              dice: [d20],
              detail,
              hidden: req?.hidden ?? false,
            })
            .returning();
          await emitRoll(io, p.campaignId, r, s.data.user, c.name);
          if (req) settleRequest(p.campaignId, req);
          io.to(room(p.campaignId)).emit("character:changed", {
            characterId: c.id,
          });
        } catch (e) {
          release();
          throw e;
        }
      }),
    };

    for (const [ev, h] of Object.entries(handlers)) s.on(ev as never, ((raw: unknown, ack?: Ack) => h(s, raw, ack)) as never);

    s.on("disconnect", () => {
      for (const cid of s.data.campaigns.keys())
        io.to(room(cid)).emit("presence", {
          campaignId: cid,
          online: setPresence(cid, s.data.user.id, -1),
        });
    });
  });
}

/** API uçlarının odaya bildirim göndermesi için. */
export function notify(campaignId: string, event: string, payload: unknown) {
  globalThis.__shzIO?.to(room(campaignId)).emit(event, payload);
}
