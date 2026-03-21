import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/[id]/approval-requests
 * GM only — Bekleyen onay isteklerini listele
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: sessionId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });

  if (!gameSession) return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  if (gameSession.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM bu istekleri görebilir." }, { status: 403 });
  }

  const requests = await prisma.characterApprovalRequest.findMany({
    where: { sessionId },
    include: {
      player: { select: { id: true, username: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(requests);
}
