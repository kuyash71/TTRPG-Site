import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findFreeSlot, type GridItem } from "@/lib/inventory-grid";
import { parseGamesetConfig } from "@/types/gameset-config";

/**
 * GET /api/characters/[id]/inventory
 * Karakter envanterini döner (items + equipped items).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId } = await params;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      session: { select: { gmId: true } },
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

  return NextResponse.json(character.inventoryItems);
}

/**
 * POST /api/characters/[id]/inventory
 * GM bir karaktere eşya ekler.
 * Body: { itemDefinitionId: string, quantity?: number }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId } = await params;

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

  // Sadece GM eşya ekleyebilir
  if (character.session.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM eşya ekleyebilir." }, { status: 403 });
  }

  const { itemDefinitionId, quantity } = await req.json();
  if (!itemDefinitionId) {
    return NextResponse.json({ error: "itemDefinitionId zorunludur." }, { status: 400 });
  }

  const itemDef = await prisma.itemDefinition.findUnique({
    where: { id: itemDefinitionId },
  });
  if (!itemDef) return NextResponse.json({ error: "Eşya tanımı bulunamadı." }, { status: 404 });

  const config = parseGamesetConfig(character.session.gameset.config);

  // Grid'de boş yer bul
  const existingItems: GridItem[] = character.inventoryItems
    .filter((i) => !i.isEquipped)
    .map((i) => ({
      id: i.id,
      posX: i.posX,
      posY: i.posY,
      gridWidth: i.itemDefinition.gridWidth,
      gridHeight: i.itemDefinition.gridHeight,
    }));

  const slot = findFreeSlot(
    existingItems,
    itemDef.gridWidth,
    itemDef.gridHeight,
    config.inventoryGridWidth,
    config.inventoryGridHeight
  );

  if (!slot) {
    return NextResponse.json({ error: "Envanterde yer yok." }, { status: 400 });
  }

  const invItem = await prisma.characterInventoryItem.create({
    data: {
      characterId,
      itemDefinitionId,
      posX: slot.x,
      posY: slot.y,
      quantity: quantity ?? 1,
    },
    include: { itemDefinition: true },
  });

  return NextResponse.json(invItem, { status: 201 });
}
