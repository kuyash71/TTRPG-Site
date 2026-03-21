import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/characters/[id]/spells/cast
 * Büyü kullan. Body: { characterSpellId: string }
 * Mana kontrolü yapar, mana düşürür.
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
    select: { userId: true, session: { select: { gmId: true } } },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;
  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { characterSpellId } = await req.json();
  if (!characterSpellId) {
    return NextResponse.json({ error: "characterSpellId zorunludur." }, { status: 400 });
  }

  const charSpell = await prisma.characterSpell.findUnique({
    where: { id: characterSpellId },
    include: { spellDefinition: true },
  });

  if (!charSpell || charSpell.characterId !== characterId) {
    return NextResponse.json({ error: "Büyü bulunamadı." }, { status: 404 });
  }

  // Mana stat kontrolü
  const manaStat = await prisma.characterStat.findFirst({
    where: {
      characterId,
      name: { in: ["Mana", "mana", "MP"] },
    },
  });

  if (manaStat && manaStat.currentValue < charSpell.spellDefinition.manaCost) {
    return NextResponse.json(
      { error: "Yeterli mana yok.", required: charSpell.spellDefinition.manaCost, current: manaStat.currentValue },
      { status: 400 }
    );
  }

  // Mana düşür
  let remainingMana: number | null = null;
  if (manaStat) {
    const updated = await prisma.characterStat.update({
      where: { id: manaStat.id },
      data: { currentValue: manaStat.currentValue - charSpell.spellDefinition.manaCost },
    });
    remainingMana = updated.currentValue;
  }

  return NextResponse.json({
    ok: true,
    spellName: charSpell.spellDefinition.name,
    manaCost: charSpell.spellDefinition.manaCost,
    remainingMana,
  });
}
