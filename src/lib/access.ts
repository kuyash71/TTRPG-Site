import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { campaignMembers, campaigns, characterLogs, characters, type Campaign, type Character } from "../db/schema";
import { bad, forbidden, notFound } from "./api";
import type { SessionUser } from "./auth/session";

export async function campaignAccess(campaignId: string, user: SessionUser) {
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!c) throw notFound("Kampanya bulunamadı.");
  const isGM = c.gmId === user.id;
  let isMember = isGM;
  let isSpectator = false;
  if (!isGM) {
    const m = await db.query.campaignMembers.findFirst({
      where: and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, user.id)),
    });
    isMember = !!m;
    isSpectator = m?.role === "SPECTATOR";
  }
  if (!isMember) throw notFound("Kampanya bulunamadı.");
  return { campaign: c, isGM, isSpectator };
}

export async function requireCampaignGM(campaignId: string, user: SessionUser) {
  const a = await campaignAccess(campaignId, user);
  if (!a.isGM) throw forbidden("Bunu yalnızca kampanyanın GM'i yapabilir.");
  return a.campaign;
}

export interface CharAccess {
  character: Character;
  campaign: Campaign;
  isGM: boolean;
  isOwner: boolean;
  isSpectator: boolean;
}

export async function characterAccess(characterId: string, user: SessionUser): Promise<CharAccess> {
  const ch = await db.query.characters.findFirst({ where: eq(characters.id, characterId) });
  if (!ch) throw notFound("Karakter bulunamadı.");
  const { campaign, isGM, isSpectator } = await campaignAccess(ch.campaignId, user);
  return { character: ch, campaign, isGM, isOwner: ch.userId === user.id, isSpectator };
}

/** Sahibi veya GM; sahibi için karakterin aktif olması gerekir. */
export async function characterEditor(characterId: string, user: SessionUser) {
  const a = await characterAccess(characterId, user);
  if (a.isGM) return a;
  if (!a.isOwner) throw forbidden();
  if (a.isSpectator) throw forbidden("İzleyiciler karakter üzerinde işlem yapamaz.");
  if (a.character.status !== "ACTIVE") throw forbidden("Karakter henüz onaylanmadı veya aktif değil.");
  return a;
}

export async function addLog(characterId: string, actorId: string | null, kind: string, text: string) {
  await db.insert(characterLogs).values({ characterId, actorId, kind, text: text.slice(0, 500) });
}

/** Diğer oyunculara gösterilebilecek alanlar. */
export function publicCharacter(c: Character) {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    status: c.status,
    level: c.level,
    nationality: c.nationality,
    alignment: c.alignment,
    age: c.age,
    appearance: c.appearance,
    trees: c.trees,
    languages: c.languages,
    portraitVersion: c.portraitVersion,
  };
}

/** Sisteme özgü uçların yanlış sistemdeki kampanyada çağrılmasını engeller. */
export function requireSystem(campaign: Pick<Campaign, "system">, system: Campaign["system"]) {
  if (campaign.system !== system) throw bad(system === "UC" ? "Bu işlem yalnızca Umbra Caelis karakterleri için." : "Bu işlem yalnızca Schwarzesonne karakterleri için.");
}

/** Sahibine gösterilen alanlar (GM notları hariç). */
export function ownerCharacter(c: Character) {
  const { gmNotes: _gm, ...rest } = c;
  return rest;
}

/** Portre adresi (sürüm değişince önbellek kırılır). Yoksa null. */
export function portraitPath(c: Pick<Character, "id" | "portraitVersion">) {
  return c.portraitVersion > 0 ? `/api/characters/${c.id}/portrait?v=${c.portraitVersion}` : null;
}
