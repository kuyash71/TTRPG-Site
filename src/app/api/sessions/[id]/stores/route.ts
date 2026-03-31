import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/sessions/[id]/stores — Session'ın mağazalarını listele
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

  const stores = await prisma.store.findMany({
    where: { sessionId },
    include: {
      items: {
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
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ stores });
}

// POST /api/sessions/[id]/stores — GM yeni mağaza oluşturur
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
  const { name, items = [] } = body as {
    name: string;
    items: { itemDefinitionId: string; basePrice: number; stock?: number | null }[];
  };

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const store = await prisma.store.create({
    data: {
      sessionId,
      name: name.trim(),
      items: {
        create: items.slice(0, 6).map((i) => ({
          itemDefinitionId: i.itemDefinitionId,
          basePrice: Math.max(0, i.basePrice ?? 0),
          stock: i.stock ?? null,
        })),
      },
    },
    include: {
      items: {
        include: {
          itemDefinition: {
            select: { id: true, name: true, description: true, category: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, rarity: true, iconUrl: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ store });
}
