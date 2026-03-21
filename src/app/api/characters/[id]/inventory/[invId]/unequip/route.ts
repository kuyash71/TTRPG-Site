import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateCharacterStats } from "@/lib/stat-engine";

/**
 * PATCH /api/characters/[id]/inventory/[invId]/unequip
 * Eşyayı kuşanmadan çıkarır.
 */
export async function PATCH(
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

  await prisma.characterInventoryItem.update({
    where: { id: invId },
    data: { isEquipped: false, equippedSlot: null },
  });

  // Stat yeniden hesaplama
  await recalculateCharacterStats(prisma, characterId);

  const stats = await prisma.characterStat.findMany({ where: { characterId } });

  return NextResponse.json({ ok: true, stats });
}
