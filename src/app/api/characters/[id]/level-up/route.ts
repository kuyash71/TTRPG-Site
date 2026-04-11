import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
      session: {
        include: {
          gameset: { select: { id: true, config: true } },
        },
      },
    },
  });

  if (!character) return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });

  // GM only
  if (character.session.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM seviye atlatabılır." }, { status: 403 });
  }

  const config = parseGamesetConfig(character.session.gameset?.config ?? {});
  // Negatif / 0 değerler için en az 1 puan vermeyi garanti et
  const pointsToAdd = config.skillPointsPerLevel > 0 ? config.skillPointsPerLevel : 1;

  if (character.level >= config.maxLevel) {
    return NextResponse.json(
      { error: `Karakter zaten maksimum seviyede (${config.maxLevel}).` },
      { status: 400 }
    );
  }

  // Skill points null olmasını önle (eski karakterler için)
  const currentSp = typeof character.skillPoints === "number" ? character.skillPoints : 0;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      level: character.level + 1,
      skillPoints: currentSp + pointsToAdd,
    },
    select: { level: true, skillPoints: true },
  });

  // Next.js Router Cache'i de temizle — router.refresh() alone may serve stale
  // server-component data for the session page in some cases.
  revalidatePath(`/session/${character.sessionId}`);

  return NextResponse.json({
    ok: true,
    newLevel: updated.level,
    skillPoints: updated.skillPoints,
    addedPoints: pointsToAdd,
  });
}
