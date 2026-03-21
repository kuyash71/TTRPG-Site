import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/characters/[id]/spells
 * Karakterin bildiği büyüleri döner.
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
    select: { userId: true, session: { select: { gmId: true } } },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;
  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const spells = await prisma.characterSpell.findMany({
    where: { characterId },
    include: { spellDefinition: true },
    orderBy: { slotIndex: "asc" },
  });

  return NextResponse.json(spells);
}
