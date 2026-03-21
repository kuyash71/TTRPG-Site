import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CharacterSheet } from "./character-sheet";
import { SkillTreeView } from "./skill-tree-view";

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
      session: { select: { id: true, name: true, gmId: true, gamesetId: true } },
      stats: true,
      wallet: true,
      class: { select: { name: true } },
      race: { select: { name: true } },
      skillUnlocks: { select: { nodeId: true, currentLevel: true } },
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

  // Skill tree node'ları (gameset varsa)
  const skillTreeNodes = character.session.gamesetId
    ? await prisma.skillTreeNode.findMany({
        where: {
          gamesetId: character.session.gamesetId,
          OR: [
            { classId: null },
            { classId: character.classId ?? undefined },
          ],
        },
      })
    : [];

  const unlockedMap: Record<string, number> = {};
  for (const u of character.skillUnlocks) {
    unlockedMap[u.nodeId] = u.currentLevel;
  }

  return (
    <>
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
          className: character.class?.name ?? null,
          raceName: character.race?.name ?? null,
          level: character.level,
          skillPoints: character.skillPoints,
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
      {skillTreeNodes.length > 0 && (
        <div className="mx-auto max-w-4xl px-6 pb-6">
          <SkillTreeView
            characterId={character.id}
            skillTreeNodes={skillTreeNodes.map((n) => ({
              id: n.id,
              name: n.name,
              description: n.description,
              nodeType: n.nodeType,
              maxLevel: n.maxLevel,
              costPerLevel: n.costPerLevel,
              unlockLevel: n.unlockLevel,
              prerequisites: n.prerequisites,
              statBonusesPerLevel: n.statBonusesPerLevel,
              effect: n.effect,
              classId: n.classId,
              posX: n.posX,
              posY: n.posY,
            }))}
            unlockedMap={unlockedMap}
            skillPoints={character.skillPoints}
            isOwner={isOwner}
            isGm={isGm}
          />
        </div>
      )}
    </>
  );
}
