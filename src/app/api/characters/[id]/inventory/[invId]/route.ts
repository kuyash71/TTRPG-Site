import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCollision, type GridItem } from "@/lib/inventory-grid";
import { parseGamesetConfig } from "@/types/gameset-config";

/**
 * PATCH /api/characters/[id]/inventory/[invId]
 * Eşyayı grid'de taşı (posX/posY güncelle).
 * Body: { posX: number, posY: number }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId, invId } = await params;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      session: {
        select: { gmId: true, gameset: { select: { config: true } } },
      },
      inventoryItems: {
        include: { itemDefinition: true },
      },
    },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;
  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const invItem = character.inventoryItems.find((i) => i.id === invId);
  if (!invItem) return NextResponse.json({ error: "Envanter öğesi bulunamadı." }, { status: 404 });

  const { posX, posY } = await req.json();
  if (typeof posX !== "number" || typeof posY !== "number") {
    return NextResponse.json({ error: "posX ve posY zorunludur." }, { status: 400 });
  }

  const config = parseGamesetConfig(character.session.gameset.config);

  // Collision check
  const existingItems: GridItem[] = character.inventoryItems
    .filter((i) => !i.isEquipped)
    .map((i) => ({
      id: i.id,
      posX: i.posX,
      posY: i.posY,
      gridWidth: i.itemDefinition.gridWidth,
      gridHeight: i.itemDefinition.gridHeight,
    }));

  const placing: GridItem = {
    id: invId,
    posX,
    posY,
    gridWidth: invItem.itemDefinition.gridWidth,
    gridHeight: invItem.itemDefinition.gridHeight,
  };

  if (checkCollision(existingItems, placing, config.inventoryGridWidth, config.inventoryGridHeight, invId)) {
    return NextResponse.json({ error: "Bu konumda çakışma var." }, { status: 400 });
  }

  const updated = await prisma.characterInventoryItem.update({
    where: { id: invId },
    data: { posX, posY },
    include: { itemDefinition: true },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/characters/[id]/inventory/[invId]
 * Eşyayı envanterden sil/düşür.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId, invId } = await params;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { userId: true, session: { select: { gmId: true } } },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;
  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  await prisma.characterInventoryItem.delete({ where: { id: invId } });

  return NextResponse.json({ ok: true });
}
