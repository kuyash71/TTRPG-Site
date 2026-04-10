import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Yetki kontrolü: GM veya oyuncu mu?
  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { players: { select: { userId: true } } },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadı" }, { status: 404 });
  }

  const isGm = gameSession.gmId === session.user.id;
  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);

  if (!isGm && !isPlayer) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 100;

  const entries = await prisma.combatLogEntry.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { gmUser: { select: { username: true } } },
  });

  const hasMore = entries.length > take;
  if (hasMore) entries.pop();

  return NextResponse.json({
    entries: entries.reverse().map((e) => ({
      id: e.id,
      gmUserId: e.gmUserId,
      gmUsername: e.gmUser.username,
      content: e.content,
      targetCharacterIds: e.targetCharacterIds,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? entries[0]?.id : null,
  });
}
