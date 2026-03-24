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

// PATCH /api/gamesets/[id]/items/[itemId]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, itemId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();

  const item = await prisma.itemDefinition.update({
    where: { id: itemId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.gridWidth !== undefined && { gridWidth: body.gridWidth }),
      ...(body.gridHeight !== undefined && { gridHeight: body.gridHeight }),
      ...(body.equipmentSlot !== undefined && { equipmentSlot: body.equipmentSlot || null }),
      ...(body.statBonuses !== undefined && { statBonuses: body.statBonuses }),
      ...(body.stackable !== undefined && { stackable: body.stackable }),
      ...(body.maxStack !== undefined && { maxStack: body.maxStack }),
      ...(body.rarity !== undefined && { rarity: body.rarity }),
      ...(body.usable !== undefined && { usable: body.usable }),
      ...(body.useStatReq !== undefined && { useStatReq: body.useStatReq }),
      ...(body.useTextReq !== undefined && { useTextReq: body.useTextReq }),
      ...(body.iconUrl !== undefined && { iconUrl: body.iconUrl || null }),
    },
  });

  return NextResponse.json(item);
}

// DELETE /api/gamesets/[id]/items/[itemId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, itemId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  await prisma.itemDefinition.delete({ where: { id: itemId } });

  return NextResponse.json({ ok: true });
}
