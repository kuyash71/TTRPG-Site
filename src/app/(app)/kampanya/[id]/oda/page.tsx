import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaignMembers, characters, users } from "@/db/schema";
import { campaignAccess, ownerCharacter, publicCharacter } from "@/lib/access";
import { absoluteRedirect, pageUser } from "@/lib/auth/session";
import { roomHref } from "@/lib/links";
import { rulesData } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";
import { Room } from "./room";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Oyun odası") };
}

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser();
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  if (access.campaign.system === "UC") await absoluteRedirect(roomHref("UC", id));
  const { campaign, isGM, isSpectator } = access;
  const rows = await db.select().from(characters).where(eq(characters.campaignId, id)).orderBy(asc(characters.createdAt));
  const chars = rows
    .filter((c) => c.status === "ACTIVE" || c.status === "DEAD" || (c.userId === user.id && c.status !== "REJECTED"))
    .map((c) => (isGM ? { view: "gm" as const, character: c } : c.userId === user.id ? { view: "owner" as const, character: ownerCharacter(c) } : { view: "public" as const, character: publicCharacter(c) }));
  const members = await db
    .select({ id: users.id, displayName: users.displayName, chatMuted: campaignMembers.chatMuted, rollMuted: campaignMembers.rollMuted, role: campaignMembers.role })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, id));
  const gm = await db.query.users.findFirst({ where: eq(users.id, campaign.gmId), columns: { id: true, displayName: true } });
  const data = rulesData(await getLocale());
  return (
    <Room
      campaign={{ id: campaign.id, name: campaign.name, deathSaveEnabled: campaign.deathSaveEnabled, physicalDice: campaign.physicalDice, system: campaign.system }}
      me={{ id: user.id, displayName: user.displayName }}
      isGM={isGM}
      isSpectator={isSpectator}
      gm={gm!}
      members={members}
      initialChars={JSON.parse(JSON.stringify(chars))}
      data={data}
      needsCharacter={!isGM && !isSpectator && !rows.some((c) => c.userId === user.id && (c.status === "ACTIVE" || c.status === "PENDING"))}
    />
  );
}
