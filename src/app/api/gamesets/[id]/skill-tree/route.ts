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

// GET /api/gamesets/[id]/skill-tree
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const nodes = await prisma.skillTreeNode.findMany({
    where: { gamesetId: id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(nodes);
}

// POST /api/gamesets/[id]/skill-tree
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  const { name, classId, nodeType, maxLevel, costPerLevel, unlockLevel, prerequisites, statBonusesPerLevel, effect, posX, posY, description } = body;

  if (!name) return NextResponse.json({ error: "Node adı zorunludur." }, { status: 400 });

  // Döngü kontrolü
  if (prerequisites && prerequisites.length > 0) {
    const existing = await prisma.skillTreeNode.findMany({
      where: { gamesetId: id },
      select: { id: true, prerequisites: true },
    });
    // Geçici bir node ekleyerek döngü kontrol et
    const tempNodes = [
      ...existing.map((n) => ({ id: n.id, prerequisites: n.prerequisites })),
      { id: "temp-new-node", prerequisites: prerequisites as string[] },
    ];
    const cycle = detectCycle(tempNodes);
    if (cycle.hasCycle) {
      return NextResponse.json(
        { error: "Bu prerequisite'ler döngü oluşturur.", cycle: cycle.path },
        { status: 400 }
      );
    }
  }

  const node = await prisma.skillTreeNode.create({
    data: {
      gamesetId: id,
      classId: classId || null,
      name,
      description: description || "",
      nodeType: nodeType || "PASSIVE",
      maxLevel: maxLevel ?? 1,
      costPerLevel: costPerLevel ?? 1,
      unlockLevel: unlockLevel ?? 1,
      prerequisites: prerequisites || [],
      statBonusesPerLevel: statBonusesPerLevel || {},
      effect: effect || null,
      posX: posX ?? 0,
      posY: posY ?? 0,
    },
  });

  return NextResponse.json(node, { status: 201 });
}
