import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CharacterWizard } from "./character-wizard";

export default async function CreateCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id: sessionId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      players: { select: { userId: true } },
      gameset: {
        include: {
          classes: { include: { subclasses: true } },
          races: true,
          statGroups: {
            orderBy: { sortOrder: "asc" },
            include: { definitions: { orderBy: { sortOrder: "asc" } } },
          },
          skillTreeNodes: true,
        },
      },
    },
  });

  if (!gameSession) redirect("/dashboard");

  // Oyuncu bu session'da mı?
  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);
  if (!isPlayer) redirect("/dashboard");

  // Zaten karakter var mı?
  const existingChar = await prisma.character.findUnique({
    where: { sessionId_userId: { sessionId, userId: session.user.id } },
  });
  if (existingChar) redirect(`/session/${sessionId}`);

  // Bekleyen istek var mı?
  const pendingRequest = await prisma.characterApprovalRequest.findFirst({
    where: { sessionId, playerId: session.user.id, status: "PENDING" },
  });

  return (
    <CharacterWizard
      sessionId={sessionId}
      sessionName={gameSession.name}
      gamesetConfig={gameSession.gameset.config as Record<string, unknown>}
      classes={gameSession.gameset.classes.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        hitDie: c.hitDie,
      }))}
      races={gameSession.gameset.races.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        racialTraits: r.racialTraits as { name: string; description: string }[],
      }))}
      statGroups={gameSession.gameset.statGroups.map((g) => ({
        id: g.id,
        name: g.name,
        definitions: g.definitions.map((d) => ({
          id: d.id,
          key: d.key,
          label: d.label,
          type: d.type,
          formula: d.formula,
          isPublic: d.isPublic,
          maxVal: d.maxVal,
        })),
      }))}
      skillTreeNodes={gameSession.gameset.skillTreeNodes.map((n) => ({
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
      pendingRequest={pendingRequest ? { id: pendingRequest.id, status: pendingRequest.status } : null}
    />
  );
}
