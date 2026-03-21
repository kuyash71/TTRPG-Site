import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateCharacterStats } from "@/lib/stat-engine";

/**
 * POST /api/sessions/[id]/approval-requests/[reqId]/approve
 * GM onayı — Karakter, SkillUnlock, Stat, Wallet oluşturulur (transaction)
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: sessionId, reqId } = await params;

  // GM kontrolü
  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true, gamesetId: true },
  });

  if (!gameSession) return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  if (gameSession.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM onaylayabilir." }, { status: 403 });
  }

  // İsteği al
  const request = await prisma.characterApprovalRequest.findUnique({
    where: { id: reqId },
  });

  if (!request) return NextResponse.json({ error: "İstek bulunamadı." }, { status: 404 });
  if (request.sessionId !== sessionId) {
    return NextResponse.json({ error: "İstek bu session'a ait değil." }, { status: 400 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Bu istek zaten işlenmiş." }, { status: 400 });
  }

  const snapshot = request.snapshot as {
    name: string;
    raceId: string;
    classId: string;
    skillAllocations: Record<string, number>;
    backstory: string;
  };

  // Transaction: karakter + skill unlock + stat + wallet oluştur
  const character = await prisma.$transaction(async (tx) => {
    // 1. Karakter oluştur
    const char = await tx.character.create({
      data: {
        sessionId,
        userId: request.playerId,
        gamesetId: gameSession.gamesetId,
        classId: snapshot.classId,
        raceId: snapshot.raceId,
        name: snapshot.name,
        level: 1,
        skillPoints: 0,
        publicData: { backstory: snapshot.backstory },
      },
    });

    // 2. Skill unlock'ları oluştur
    const unlockEntries = Object.entries(snapshot.skillAllocations)
      .filter(([, lvl]) => lvl > 0);

    if (unlockEntries.length > 0) {
      await tx.characterSkillUnlock.createMany({
        data: unlockEntries.map(([nodeId, currentLevel]) => ({
          characterId: char.id,
          nodeId,
          currentLevel,
        })),
      });
    }

    // 3. Wallet oluştur
    await tx.characterWallet.create({
      data: { characterId: char.id, gold: 0, silver: 0, copper: 0 },
    });

    // 4. İsteği onayla
    await tx.characterApprovalRequest.update({
      where: { id: reqId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    });

    return char;
  });

  // 5. Statları hesapla (transaction dışında, kendi transaction'ı var)
  await recalculateCharacterStats(prisma, character.id);

  return NextResponse.json({ ok: true, characterId: character.id });
}
