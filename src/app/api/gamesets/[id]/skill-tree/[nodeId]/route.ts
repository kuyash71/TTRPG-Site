import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectCycle } from "@/lib/cycle-detection";

async function verifyOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// PATCH /api/gamesets/[id]/skill-tree/[nodeId]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, nodeId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();

  // Prerequisite değiştiyse döngü kontrolü
  if (body.prerequisites) {
    const existing = await prisma.skillTreeNode.findMany({
      where: { gamesetId: id },
      select: { id: true, prerequisites: true },
    });
    const tempNodes = existing.map((n) =>
      n.id === nodeId
        ? { id: n.id, prerequisites: body.prerequisites as string[] }
        : { id: n.id, prerequisites: n.prerequisites }
    );
    const cycle = detectCycle(tempNodes);
    if (cycle.hasCycle) {
      return NextResponse.json(
        { error: "Bu prerequisite'ler döngü oluşturur.", cycle: cycle.path },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.skillTreeNode.update({
    where: { id: nodeId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.classId !== undefined && { classId: body.classId || null }),
      ...(body.nodeType !== undefined && { nodeType: body.nodeType }),
      ...(body.maxLevel !== undefined && { maxLevel: body.maxLevel }),
      ...(body.costPerLevel !== undefined && { costPerLevel: body.costPerLevel }),
      ...(body.unlockLevel !== undefined && { unlockLevel: body.unlockLevel }),
      ...(body.prerequisites !== undefined && { prerequisites: body.prerequisites }),
      ...(body.statBonusesPerLevel !== undefined && { statBonusesPerLevel: body.statBonusesPerLevel }),
      ...(body.effect !== undefined && { effect: body.effect }),
      ...(body.spellDefinitionId !== undefined && { spellDefinitionId: body.spellDefinitionId || null }),
      ...(body.posX !== undefined && { posX: body.posX }),
      ...(body.posY !== undefined && { posY: body.posY }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/gamesets/[id]/skill-tree/[nodeId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, nodeId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  // Karakter unlock kontrolü
  const unlockCount = await prisma.characterSkillUnlock.count({
    where: { nodeId },
  });
  if (unlockCount > 0) {
    return NextResponse.json(
      { error: "Bu node'u kullanan karakterler var. Önce onları kaldırın." },
      { status: 400 }
    );
  }

  // Diğer node'ların prerequisite'lerinden kaldır
  const dependents = await prisma.skillTreeNode.findMany({
    where: {
      gamesetId: id,
      prerequisites: { has: nodeId },
    },
  });

  await prisma.$transaction([
    // Prerequisite'lerden temizle
    ...dependents.map((dep) =>
      prisma.skillTreeNode.update({
        where: { id: dep.id },
        data: {
          prerequisites: dep.prerequisites.filter((p) => p !== nodeId),
        },
      })
    ),
    // Node'u sil
    prisma.skillTreeNode.delete({ where: { id: nodeId } }),
  ]);

  return NextResponse.json({ ok: true });
}
