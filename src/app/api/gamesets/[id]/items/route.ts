import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// GET /api/gamesets/[id]/items
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const items = await prisma.itemDefinition.findMany({
    where: { gamesetId: id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(items);
}

// POST /api/gamesets/[id]/items
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
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Eşya adı zorunludur." }, { status: 400 });
  }

  const item = await prisma.itemDefinition.create({
    data: {
      gamesetId: id,
      name: body.name.trim(),
      description: body.description || "",
      category: body.category || "MISC",
      gridWidth: body.gridWidth ?? 1,
      gridHeight: body.gridHeight ?? 1,
      equipmentSlot: body.equipmentSlot || null,
      statBonuses: body.statBonuses || {},
      stackable: body.stackable ?? false,
      maxStack: body.maxStack ?? 1,
      rarity: body.rarity || "COMMON",
      iconUrl: body.iconUrl || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
