import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CharacterSheet } from "./character-sheet";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true } },
      session: { select: { id: true, name: true, gmId: true } },
      stats: true,
      wallet: true,
    },
  });

  if (!character) redirect("/dashboard");

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;

  // Anyone in the session can view, but with filtered data
  const filteredStats =
    isOwner || isGm
      ? character.stats
      : character.stats.filter((s) => s.isPublic);

  return (
    <CharacterSheet
      character={{
        id: character.id,
        name: character.name,
        avatarUrl: character.avatarUrl,
        publicData: character.publicData as Record<string, unknown>,
        privateData:
          isOwner || isGm
            ? (character.privateData as Record<string, unknown>)
            : {},
        sessionId: character.session.id,
        sessionName: character.session.name,
        ownerUsername: character.user.username,
      }}
      stats={filteredStats.map((s) => ({
        name: s.name,
        baseValue: s.baseValue,
        currentValue: s.currentValue,
        maxValue: s.maxValue,
        isPublic: s.isPublic,
      }))}
      wallet={
        isOwner || isGm
          ? character.wallet
            ? {
                gold: character.wallet.gold,
                silver: character.wallet.silver,
                copper: character.wallet.copper,
              }
            : null
          : null
      }
      isOwner={isOwner}
      isGm={isGm}
    />
  );
}
