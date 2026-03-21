import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGamesetConfig } from "@/types/gameset-config";

/**
 * POST /api/characters/[id]/level-up
 * GM aksiyonu — Karakterin seviyesini 1 artırır ve skill puanı ekler.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: characterId } = await params;

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      session: { select: { gmId: true, gameset: true } },
    },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  // GM only
  if (character.session.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM seviye atlatabılır." }, { status: 403 });
  }

  const config = parseGamesetConfig(character.session.gameset.config);

  if (character.level >= config.maxLevel) {
    return NextResponse.json(
      { error: `Karakter zaten maksimum seviyede (${config.maxLevel}).` },
      { status: 400 }
    );
  }

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      level: character.level + 1,
      skillPoints: character.skillPoints + config.skillPointsPerLevel,
    },
  });

  return NextResponse.json({
    ok: true,
    newLevel: updated.level,
    skillPoints: updated.skillPoints,
    addedPoints: config.skillPointsPerLevel,
  });
}
