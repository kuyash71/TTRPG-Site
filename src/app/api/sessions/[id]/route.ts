import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/generated/prisma/client";

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  OPEN: ["ACTIVE", "CLOSED"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

// PATCH /api/sessions/[id] — session durumunu güncelle (GM only)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const gameSession = await prisma.session.findUnique({
    where: { id: params.id },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  }

  if (gameSession.gmId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { status } = await req.json();

  if (!status || !VALID_TRANSITIONS[gameSession.status]?.includes(status)) {
    return NextResponse.json(
      {
        error: `Geçersiz durum geçişi: ${gameSession.status} → ${status}`,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.session.update({
    where: { id: params.id },
    data: {
      status,
      closedAt: status === "CLOSED" ? new Date() : undefined,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/sessions/[id] — session sil (GM: kalici silme, Player: listeden cikar)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giris yapilmadi." }, { status: 401 });
  }

  const { id } = params;

  const gameSession = await prisma.session.findUnique({
    where: { id },
    include: { players: true },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadi." }, { status: 404 });
  }

  const isGm = gameSession.gmId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);

  // GM or ADMIN: permanently delete (only CLOSED sessions)
  if (isGm || isAdmin) {
    if (gameSession.status !== "CLOSED") {
      return NextResponse.json(
        { error: "Sadece kapatilmis session silinebilir." },
        { status: 400 }
      );
    }

    // Delete in order due to FK constraints
    await prisma.$transaction([
      prisma.characterApprovalRequest.deleteMany({ where: { sessionId: id } }),
      prisma.chatMessage.deleteMany({ where: { sessionId: id } }),
      prisma.diceRoll.deleteMany({ where: { sessionId: id } }),
      prisma.characterStat.deleteMany({ where: { character: { sessionId: id } } }),
      prisma.characterWallet.deleteMany({ where: { character: { sessionId: id } } }),
      prisma.characterSkillUnlock.deleteMany({ where: { character: { sessionId: id } } }),
      prisma.characterInventoryItem.deleteMany({ where: { character: { sessionId: id } } }),
      prisma.characterSpell.deleteMany({ where: { character: { sessionId: id } } }),
      prisma.character.deleteMany({ where: { sessionId: id } }),
      prisma.sessionPlayer.deleteMany({ where: { sessionId: id } }),
      prisma.session.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, action: "deleted" });
  }

  // Player: remove from their list (leave closed session)
  if (isPlayer && gameSession.status === "CLOSED") {
    await prisma.sessionPlayer.deleteMany({
      where: { sessionId: id, userId: session.user.id },
    });
    return NextResponse.json({ ok: true, action: "left" });
  }

  return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
}

// GET /api/sessions/[id] — session detayi
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const gameSession = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      gm: { select: { id: true, username: true } },
      gameset: { select: { id: true, name: true } },
      players: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  }

  // Erişim kontrolü: GM, ADMIN veya session oyuncusu
  const isGm = gameSession.gmId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);

  if (!isGm && !isAdmin && !isPlayer) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  return NextResponse.json(gameSession);
}
