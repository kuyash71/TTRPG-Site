import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/characters/[id]/spells/[csId]
 * Büyüyü slot'a ata. Body: { slotIndex: number | null }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; csId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId, csId } = await params;

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

  const { slotIndex } = await req.json();

  // Eğer slotIndex doluysa, mevcut slot sahibini kaldır
  if (slotIndex !== null && slotIndex !== undefined) {
    await prisma.characterSpell.updateMany({
      where: { characterId, slotIndex },
      data: { slotIndex: null },
    });
  }

  const updated = await prisma.characterSpell.update({
    where: { id: csId },
    data: { slotIndex: slotIndex ?? null },
    include: { spellDefinition: true },
  });

  return NextResponse.json(updated);
}
