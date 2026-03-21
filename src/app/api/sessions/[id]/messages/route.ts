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

  // Verify user is participant or GM
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
  const take = 50;

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { username: true } } },
  });

  const hasMore = messages.length > take;
  if (hasMore) messages.pop();

  return NextResponse.json({
    messages: messages.reverse().map((m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      channel: m.channel,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? messages[0]?.id : null,
  });
}
