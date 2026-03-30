import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { parseGamesetConfig } from "@/types/gameset-config";
import { SessionRoom } from "./session-room";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id },
    include: {
      gm: { select: { id: true, username: true } },
      gameset: {
        select: {
          id: true,
          name: true,
          config: true,
          skillTreeNodes: {
            select: { id: true, name: true, description: true, classId: true, posX: true, posY: true, maxLevel: true, costPerLevel: true, unlockLevel: true, prerequisites: true, statBonusesPerLevel: true, effect: true, nodeType: true, spellDefinitionId: true },
          },
        },
      },
      players: {
        include: { user: { select: { id: true, username: true } } },
      },
      characters: {
        include: {
          stats: true,
          user: { select: { id: true, username: true } },
          class: { select: { name: true } },
          race: { select: { name: true } },
          skillUnlocks: { select: { nodeId: true, currentLevel: true } },
          inventoryItems: {
            include: { itemDefinition: { select: { name: true, description: true, category: true, equipmentSlot: true, rarity: true, statBonuses: true, gridWidth: true, gridHeight: true } } },
          },
          spells: {
            include: { spellDefinition: { select: { id: true, name: true, description: true, manaCost: true, cooldown: true, range: true, targetType: true, requiredLevel: true } } },
            orderBy: { slotIndex: "asc" },
          },
        },
      },
    },
  });

  if (!gameSession) redirect("/dashboard");

  const isGm = gameSession.gmId === session.user.id;
  const isPlayer = gameSession.players.some(
    (p) => p.userId === session.user.id
  );

  if (!isGm && !isPlayer) redirect("/dashboard");

  const config = parseGamesetConfig(gameSession.gameset.config);

  // Oyuncunun bu session'da karakteri var mı?
  const hasCharacter = gameSession.characters.some(
    (c) => c.userId === session.user.id
  );

  // Bekleyen onay isteği var mı?
  const pendingApproval = !isGm
    ? !!(await prisma.characterApprovalRequest.findFirst({
        where: {
          sessionId: gameSession.id,
          playerId: session.user.id,
          status: "PENDING",
        },
      }))
    : false;

  return (
    <SessionRoom
      sessionId={gameSession.id}
      sessionName={gameSession.name}
      gamesetName={gameSession.gameset.name}
      status={gameSession.status}
      inviteCode={gameSession.inviteCode}
      gm={gameSession.gm}
      players={gameSession.players.map((p) => ({
        id: p.user.id,
        username: p.user.username,
      }))}
      gamesetId={gameSession.gameset.id}
      inventoryGridWidth={config.inventoryGridWidth}
      inventoryGridHeight={config.inventoryGridHeight}
      equipmentSlotsEnabled={config.equipmentSlotsEnabled}
      inventoryCapacityStat={config.inventoryCapacityStat}
      inventoryCapacityRowsPerPoint={config.inventoryCapacityRowsPerPoint}
      characters={gameSession.characters.map((c) => ({
        id: c.id,
        userId: c.user.id,
        name: c.name,
        username: c.user.username,
        classId: c.classId ?? null,
        className: c.class?.name ?? null,
        raceName: c.race?.name ?? null,
        level: c.level,
        publicData: c.publicData as Record<string, unknown>,
        privateData: c.privateData as Record<string, unknown>,
        stats: c.stats.map((s) => ({
          name: s.name,
          baseValue: s.baseValue,
          currentValue: s.currentValue,
          maxValue: s.maxValue,
          isPublic: s.isPublic,
        })),
        equippedItems: c.inventoryItems
          .filter((i) => i.isEquipped)
          .map((i) => ({
            name: i.itemDefinition.name,
            slot: i.itemDefinition.equipmentSlot ?? "",
            rarity: i.itemDefinition.rarity,
          })),
        inventoryItems: c.inventoryItems.map((i) => ({
          id: i.id,
          name: i.itemDefinition.name,
          description: i.itemDefinition.description,
          category: i.itemDefinition.category,
          equipmentSlot: i.itemDefinition.equipmentSlot,
          rarity: i.itemDefinition.rarity,
          statBonuses: (i.itemDefinition.statBonuses as Record<string, number>) ?? {},
          gridWidth: i.itemDefinition.gridWidth,
          gridHeight: i.itemDefinition.gridHeight,
          posX: i.posX,
          posY: i.posY,
          quantity: i.quantity,
          isEquipped: i.isEquipped,
          equippedSlot: i.equippedSlot,
        })),
        skillUnlocks: c.skillUnlocks.map((u) => ({
          nodeId: u.nodeId,
          currentLevel: u.currentLevel,
        })),
        spells: c.spells.map((s) => ({
          id: s.id,
          slotIndex: s.slotIndex,
          spellDefinition: {
            id: s.spellDefinition.id,
            name: s.spellDefinition.name,
            description: s.spellDefinition.description,
            manaCost: s.spellDefinition.manaCost,
            cooldown: s.spellDefinition.cooldown,
            range: s.spellDefinition.range,
            targetType: s.spellDefinition.targetType,
            requiredLevel: s.spellDefinition.requiredLevel,
          },
        })),
      }))}
      skillTreeNodes={gameSession.gameset.skillTreeNodes.map((n) => ({
        id: n.id,
        name: n.name,
        description: n.description,
        classId: n.classId,
        posX: n.posX,
        posY: n.posY,
        maxLevel: n.maxLevel,
        costPerLevel: n.costPerLevel,
        unlockLevel: n.unlockLevel,
        prerequisites: n.prerequisites as string[],
        statBonusesPerLevel: n.statBonusesPerLevel as Record<string, number>,
        effect: n.effect,
        nodeType: n.nodeType,
        spellDefinitionId: n.spellDefinitionId,
      }))}
      hpSystem={config.hpSystem}
      realisticHpStates={config.realisticHpStates}
      currentUser={{
        id: session.user.id,
        username: session.user.username,
        isGm,
      }}
      manaLabel={config.manaLabel}
      hasCharacter={hasCharacter}
      pendingApproval={pendingApproval}
    />
  );
}
