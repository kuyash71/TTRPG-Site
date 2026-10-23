// Schwarzesonne 2.0 veritabanı şeması (Drizzle ORM).
// Oyun içeriği (yetenekler, perkler, augmentler) veritabanında DEĞİL,
// content/shz.json içinde durur; burada yalnızca oyuncu verisi tutulur.
import { randomUUID } from "node:crypto";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BandageKey, StatKey, WoundKey } from "../lib/shz/constants";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["GM", "PLAYER"]);
export const characterStatusEnum = pgEnum("character_status", ["PENDING", "ACTIVE", "REJECTED", "DEAD", "RETIRED"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["ACTIVE", "PAUSED", "ARCHIVED"]);
export const channelEnum = pgEnum("message_channel", ["IC", "OOC", "WHISPER", "SYSTEM"]);
/** Kampanyadaki üyelik rolü: izleyici karakter oluşturamaz, sahneye yazamaz, zar atamaz. */
export const memberRoleEnum = pgEnum("member_role", ["PLAYER", "SPECTATOR"]);
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];

export type Role = (typeof roleEnum.enumValues)[number];
export type CharacterStatus = (typeof characterStatusEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("PLAYER"),
  /** Site yöneticisi: kullanıcıları yönetir, GM daveti üretebilir. */
  isAdmin: boolean("is_admin").notNull().default(false),
  disabled: boolean("disabled").notNull().default(false),
  /** Şifre sıfırlama koduyla girildi: bir sonraki sayfada yeni şifre belirlemek zorunda. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: created(),
});

/** Sunucu tarafı oturum. Çerezde rastgele token, burada yalnızca SHA-256 özeti tutulur. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: created(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Giriş denemesi sınırlaması (IP ve kullanıcı adı bazlı). */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    key: text("key").notNull(),
    createdAt: created(),
  },
  (t) => [index("login_attempts_key_idx").on(t.key, t.createdAt)],
);

/** Kampanyanın oyun sistemi: Schwarzesonne ya da Umbra Caelis. Aynı hesap ikisinde de oynar. */
export const gameSystemEnum = pgEnum("game_system", ["SHZ", "UC"]);
export type GameSystem = (typeof gameSystemEnum.enumValues)[number];

export const campaigns = pgTable("campaigns", {
  id: id(),
  system: gameSystemEnum("system").notNull().default("SHZ"),
  name: text("name").notNull(),
  contentKey: text("content_key"),
  description: text("description").notNull().default(""),
  status: campaignStatusEnum("status").notNull().default("ACTIVE"),
  gmId: text("gm_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  joinCode: text("join_code").notNull().unique(),
  /** İzleyici olarak katılma kodu (isteğe bağlı). */
  spectatorCode: text("spectator_code").unique(),
  startPerkPoints: integer("start_perk_points").notNull().default(0),
  levelCap: integer("level_cap").notNull().default(10),
  deathSaveEnabled: boolean("death_save_enabled").notNull().default(true),
  /** Fiziksel masa: zarları oyuncular gerçek zarla atar, sonucu GM sisteme girer (dijital zar kapalı). */
  physicalDice: boolean("physical_dice").notNull().default(false),
  createdAt: created(),
});

/** Hesap daveti. Kod yalnızca oluşturulduğunda bir kez gösterilir; burada özeti tutulur. */
export const invites = pgTable("invites", {
  id: id(),
  codeHash: text("code_hash").notNull().unique(),
  hint: text("hint").notNull(),
  note: text("note"),
  role: roleEnum("role").notNull().default("PLAYER"),
  campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  /** Kampanyaya bağlı davette katılım rolü. */
  memberRole: memberRoleEnum("member_role").notNull().default("PLAYER"),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  usedById: text("used_by_id").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: created(),
});

export const campaignMembers = pgTable(
  "campaign_members",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    role: memberRoleEnum("role").notNull().default("PLAYER"),
    /** GM tarafından sohbette susturuldu */
    chatMuted: boolean("chat_muted").notNull().default(false),
    /** GM tarafından zar atmada susturuldu */
    rollMuted: boolean("roll_muted").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.userId] }), index("members_user_idx").on(t.userId)],
);

export type Stats = Record<StatKey, number>;
export interface BodyPartState {
  wound: WoundKey;
  bandage: BandageKey;
  augment: string | null;
  note: string;
  /** Karakter oluşturmada Kriegsversehrt perki ile kopuk başlayan uzuv */
  lost?: "kriegsversehrt";
}
export type Body = Partial<Record<string, BodyPartState>>;
export interface DeathSave {
  available: boolean;
  resets: number;
  deaths: number;
  saves: number;
}
export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  note: string;
}

/** GM'in bir karaktere özel yazdığı yetenek (puan harcatmaz, katman kurallarına girmez). */
export interface CustomAbility {
  id: string;
  name: string;
  /** Sitedeki simge setinden bir anahtar (ör. "dal:shinigami", "tree:ubermann", "type:Aktif", "glyph:skull") */
  icon: string;
  type: "Aktif" | "Pasif" | "Tepki";
  maxLevel: 1 | 2 | 3;
  /** Karakterin mevcut seviyesi (0 = kilitli/gizli değil, henüz açılmamış) */
  level: number;
  /** Seviye başına etki metni (uzunluk = maxLevel) */
  levels: string[];
  requirement: string;
  cost: string;
  synergy: string;
  note: string;
  flavor: string;
}

/** Yozlaşma çatalları (3, 6, 9, 12): Teslim ya da Direniş. */
export type UcForkChoice = "teslim" | "direnis";
export interface UcCharData {
  classKey?: string;
  faith?: string;
  /** Priest: kasadaki inanç anahtarı ("trifarium/excidis") ve serbest ayrıntı (ejder/duygu) */
  faithKey?: string;
  faithDetail?: string;
  food?: string;
  /** Dal mekaniği sayaçları (Akış, Açıklık, Atılım, Lütuf, Kızıl Yük...) */
  counters?: Record<string, number>;
  /** Dal mekaniği notları (Av Defteri, İpler) — anahtar: sayaç anahtarı */
  dalNotes?: Record<string, string>;
  forks?: Partial<Record<"3" | "6" | "9" | "12", UcForkChoice>>;
  /** Dalı henüz seçilmemiş katmanda kazanılan sembol stat puanları (dal seçilince eklenir). */
  pendingSymbol?: number;
}

export const characters = pgTable(
  "characters",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    /** Karakterin sahibi; null ise sahipsizdir (GM devredebilir). */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: characterStatusEnum("status").notNull().default("PENDING"),
    reviewNote: text("review_note"),

    name: text("name").notNull(),
    age: integer("age").notNull(),
    nationality: text("nationality").notNull(),
    alignment: text("alignment").notNull(),
    background: text("background").notNull().default(""),
    appearance: text("appearance").notNull().default(""),

    level: integer("level").notNull().default(0),
    abilityPoints: integer("ability_points").notNull().default(1),
    freeStatPoints: integer("free_stat_points").notNull().default(0),
    stats: jsonb("stats").$type<Stats>().notNull(),
    trees: text("trees").array().notNull().default([]),
    /** GM'in açılmasına izin verdiği kısıtlı ağaçlar (ör. Mors: Morswecken bulunduktan sonra). */
    treeGrants: text("tree_grants").array().notNull().default([]),
    abilities: jsonb("abilities").$type<Record<string, number>>().notNull().default({}),
    perks: text("perks").array().notNull().default([]),
    /** Bildiği diller (ilki ana dil). */
    languages: text("languages").array().notNull().default([]),
    body: jsonb("body").$type<Body>().notNull().default({}),
    corruption: integer("corruption").notNull().default(0),
    corruptionLocked: boolean("corruption_locked").notNull().default(false),
    inspiration: integer("inspiration").notNull().default(0),
    deathSave: jsonb("death_save").$type<DeathSave>().notNull().default({ available: true, resets: 0, deaths: 0, saves: 0 }),
    money: integer("money").notNull().default(0),
    inventory: jsonb("inventory").$type<InventoryItem[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    /** Oyuncunun yalnızca GM ile paylaştığı gizli geçmiş / lore. Diğer oyuncular görmez. */
    secretNotes: text("secret_notes").notNull().default(""),
    /** Portre yüklüyse sürüm damgası (önbellek kırmak için). */
    portraitVersion: integer("portrait_version").notNull().default(0),
    /** GM izni: oyuncu perklerini bir kez yeniden düzenleyebilir. */
    perkEditAllowed: boolean("perk_edit_allowed").notNull().default(false),
    gmNotes: text("gm_notes").notNull().default(""),
    /** GM'in bu karaktere özel yazdığı yetenekler (SHZ ve UC). */
    customAbilities: jsonb("custom_abilities").$type<CustomAbility[]>().notNull().default([]),
    /** Umbra Caelis'e özgü alanlar (SHZ karakterlerinde boş). */
    uc: jsonb("uc").$type<UcCharData>().notNull().default({}),
    createdAt: created(),
    // milisaniye hassasiyeti: koşullu güncellemelerde (yarış koruması) JS Date ile birebir eşleşir
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("characters_campaign_idx").on(t.campaignId), index("characters_user_idx").on(t.userId)],
);

export const characterLogs = pgTable(
  "character_logs",
  {
    id: id(),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    createdAt: created(),
  },
  (t) => [index("logs_character_idx").on(t.characterId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
    recipientId: text("recipient_id").references(() => users.id, { onDelete: "set null" }),
    channel: channelEnum("channel").notNull(),
    content: text("content").notNull(),
    createdAt: created(),
  },
  (t) => [index("messages_campaign_idx").on(t.campaignId, t.createdAt)],
);

export interface RollPart {
  label: string;
  value: number;
}
export interface RollDetail {
  parts: RollPart[];
  total: number;
  threshold: number | null;
  thresholdLabel: string | null;
  outcome: "success" | "fail" | "crit-success" | "crit-fail" | "death" | "save" | "info";
  note?: string;
  rerollOf?: string;
  requestId?: string;
  /** Death Save ilerlemesi (zar kartında gösterilir). */
  deathTrack?: { deaths: number; saves: number; final: "death" | "save" | null };
  /** Zarı kimin istediği / hangi isteğe yanıt olduğu. */
  requested?: boolean;
  /** Fiziksel zar: değeri masada atıldı, GM girdi. */
  physical?: boolean;
  /** Zar kartında gösterilen ek açıklama (taşan bonus, Nat1 geri tepme…). */
  extra?: string;
}

export const rolls = pgTable(
  "rolls",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    characterId: text("character_id").references(() => characters.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    dice: integer("dice").array().notNull(),
    detail: jsonb("detail").$type<RollDetail>().notNull(),
    hidden: boolean("hidden").notNull().default(false),
    rerolled: boolean("rerolled").notNull().default(false),
    createdAt: created(),
  },
  (t) => [index("rolls_campaign_idx").on(t.campaignId, t.createdAt)],
);

/** Şifremi unuttum istekleri: kampanyanın GM'i ya da site yöneticisi onaylar, tek kullanımlık kod üretilir. */
export const resetStatusEnum = pgEnum("reset_status", ["PENDING", "APPROVED", "USED", "DENIED"]);
export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: resetStatusEnum("status").notNull().default("PENDING"),
    ip: text("ip"),
    decidedById: text("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    codeHash: text("code_hash"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId, t.status)],
);
export type PasswordReset = typeof passwordResets.$inferSelect;

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Roll = typeof rolls.$inferSelect;


const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Karakter portresi: sunucuda yeniden kodlanmış WebP (en fazla 512 px). */
export const portraits = pgTable("portraits", {
  characterId: text("character_id")
    .primaryKey()
    .references(() => characters.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
