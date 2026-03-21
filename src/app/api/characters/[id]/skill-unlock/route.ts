import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateCharacterStats } from "@/lib/stat-engine";

/**
 * POST /api/characters/[id]/skill-unlock
 * Oyuncu bir skill node'u açar veya seviye atlar.
 * Body: { nodeId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId } = await params;
  const { nodeId } = await req.json();

  if (!nodeId) return NextResponse.json({ error: "nodeId zorunludur." }, { status: 400 });

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      skillUnlocks: true,
      session: { select: { gmId: true } },
    },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;
  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  // Node'u al
  const node = await prisma.skillTreeNode.findUnique({ where: { id: nodeId } });
  if (!node) return NextResponse.json({ error: "Skill node bulunamadı." }, { status: 404 });

  // Karakter seviyesi kontrolü
  if (character.level < node.unlockLevel) {
    return NextResponse.json(
      { error: `Bu node için seviye ${node.unlockLevel} gerekli.` },
      { status: 400 }
    );
  }

  // Prerequisite kontrolü
  const unlockedNodeIds = new Set(character.skillUnlocks.map((u) => u.nodeId));
  for (const prereqId of node.prerequisites) {
    if (!unlockedNodeIds.has(prereqId)) {
      return NextResponse.json(
        { error: "Ön koşul node'ları tamamlanmamış." },
        { status: 400 }
      );
    }
  }

  // Mevcut unlock seviyesi
  const existingUnlock = character.skillUnlocks.find((u) => u.nodeId === nodeId);
  const currentLevel = existingUnlock?.currentLevel ?? 0;

  if (currentLevel >= node.maxLevel) {
    return NextResponse.json({ error: "Bu node maksimum seviyede." }, { status: 400 });
  }

  // Yeterli skill puanı var mı?
  if (character.skillPoints < node.costPerLevel) {
    return NextResponse.json(
      { error: `Yetersiz skill puanı. Gerekli: ${node.costPerLevel}, Mevcut: ${character.skillPoints}` },
      { status: 400 }
    );
  }

  // Transaction: unlock + skillPoints düşür + stat yeniden hesapla
  await prisma.$transaction(async (tx) => {
    if (existingUnlock) {
      await tx.characterSkillUnlock.update({
        where: { id: existingUnlock.id },
        data: { currentLevel: currentLevel + 1 },
      });
    } else {
      await tx.characterSkillUnlock.create({
        data: { characterId, nodeId, currentLevel: 1 },
      });
    }

    await tx.character.update({
      where: { id: characterId },
      data: { skillPoints: character.skillPoints - node.costPerLevel },
    });
  });

  // Stat yeniden hesaplama
  await recalculateCharacterStats(prisma, characterId);

  const updatedChar = await prisma.character.findUnique({
    where: { id: characterId },
    select: { skillPoints: true },
  });

  return NextResponse.json({
    ok: true,
    newLevel: currentLevel + 1,
    remainingPoints: updatedChar?.skillPoints ?? 0,
  });
}
