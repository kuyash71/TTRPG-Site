import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateCharacterStats } from "@/lib/stat-engine";
import type { EquipmentSlot } from "@/generated/prisma/client";

/**
 * PATCH /api/characters/[id]/inventory/[invId]/equip
 * Eşyayı kuşanır. Body: { slot: EquipmentSlot }
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
      session: { select: { gmId: true } },
      inventoryItems: { include: { itemDefinition: true } },
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

  const { slot } = await req.json() as { slot: EquipmentSlot };

  // Item'ın bu slot'a uygun olup olmadığını kontrol et
  if (!invItem.itemDefinition.equipmentSlot) {
    return NextResponse.json({ error: "Bu eşya kuşanılamaz." }, { status: 400 });
  }
  if (invItem.itemDefinition.equipmentSlot !== slot) {
    return NextResponse.json({ error: "Eşya bu slot'a uygun değil." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // Mevcut slot'taki item'ı unequip et
    await tx.characterInventoryItem.updateMany({
      where: { characterId, equippedSlot: slot, isEquipped: true },
      data: { isEquipped: false, equippedSlot: null },
    });

    // Yeni item'ı equip et
    await tx.characterInventoryItem.update({
      where: { id: invId },
      data: { isEquipped: true, equippedSlot: slot },
    });
  });

  // Stat yeniden hesaplama
  await recalculateCharacterStats(prisma, characterId);

  const stats = await prisma.characterStat.findMany({ where: { characterId } });

  return NextResponse.json({ ok: true, stats });
}
