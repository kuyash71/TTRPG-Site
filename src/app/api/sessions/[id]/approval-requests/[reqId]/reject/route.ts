import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/sessions/[id]/approval-requests/[reqId]/reject
 * GM reddi — gmComment eklenir
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: sessionId, reqId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });

  if (!gameSession) return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  if (gameSession.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece GM reddedebilir." }, { status: 403 });
  }

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

  const body = await req.json();

  await prisma.characterApprovalRequest.update({
    where: { id: reqId },
    data: {
      status: "REJECTED",
      gmComment: body.gmComment || null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
