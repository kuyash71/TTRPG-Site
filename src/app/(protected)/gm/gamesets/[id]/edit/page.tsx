import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { GamesetEditor } from "./gameset-editor";

export default async function GamesetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({
    where: { id },
    include: {
      statGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          definitions: { orderBy: { sortOrder: "asc" } },
        },
      },
      classes: {
        include: { subclasses: true },
      },
      races: true,
      skillTreeNodes: true,
      itemDefinitions: true,
      spellDefinitions: true,
    },
  });

  if (!gameset) redirect("/dashboard");

  if (
    gameset.createdById !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    redirect("/dashboard");
  }

  return (
    <GamesetEditor
      gameset={{
        id: gameset.id,
        name: gameset.name,
        description: gameset.description,
        config: gameset.config as Record<string, unknown>,
        statGroups: gameset.statGroups.map((g) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          sortOrder: g.sortOrder,
          definitions: g.definitions.map((d) => ({
            id: d.id,
            key: d.key,
            label: d.label,
            type: d.type,
            formula: d.formula,
            isPublic: d.isPublic,
            maxVal: d.maxVal,
            sortOrder: d.sortOrder,
          })),
        })),
        classes: gameset.classes.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          hitDie: c.hitDie,
          subclasses: c.subclasses.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            unlockLevel: s.unlockLevel,
          })),
        })),
        races: gameset.races.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          racialTraits: r.racialTraits as { name: string; description: string }[],
        })),
        skillTreeNodes: gameset.skillTreeNodes.map((n) => ({
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
          spellDefinitionId: n.spellDefinitionId,
          posX: n.posX,
          posY: n.posY,
        })),
        itemDefinitions: gameset.itemDefinitions.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          category: i.category,
          gridWidth: i.gridWidth,
          gridHeight: i.gridHeight,
          equipmentSlot: i.equipmentSlot,
          statBonuses: i.statBonuses,
          stackable: i.stackable,
          maxStack: i.maxStack,
          rarity: i.rarity,
          iconUrl: i.iconUrl,
        })),
        spellDefinitions: gameset.spellDefinitions.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          manaCost: s.manaCost,
          cooldown: s.cooldown,
          range: s.range,
          targetType: s.targetType,
          effects: s.effects,
          iconUrl: s.iconUrl,
          requiredLevel: s.requiredLevel,
        })),
      }}
    />
  );
}
