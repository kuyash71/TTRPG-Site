import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/sessions/[id]/loot — Loot havuzunu getir
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true, players: { select: { userId: true } } },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isGm = gameSession.gmId === session.user.id;
  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);
  if (!isGm && !isPlayer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lootItems = await prisma.sessionLootItem.findMany({
    where: { sessionId },
    include: {
      itemDefinition: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          gridWidth: true,
          gridHeight: true,
          equipmentSlot: true,
          statBonuses: true,
          rarity: true,
          iconUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ lootItems });
}

// POST /api/sessions/[id]/loot — GM eşya ekler
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gameSession.gmId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { itemDefinitionId, quantity = 1 } = body;
  if (!itemDefinitionId) return NextResponse.json({ error: "itemDefinitionId required" }, { status: 400 });

  const lootItem = await prisma.sessionLootItem.create({
    data: { sessionId, itemDefinitionId, quantity },
    include: {
      itemDefinition: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          gridWidth: true,
          gridHeight: true,
          equipmentSlot: true,
          statBonuses: true,
          rarity: true,
          iconUrl: true,
        },
      },
    },
  });

  return NextResponse.json({ lootItem });
}
