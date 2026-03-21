import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionStatus } from "@/generated/prisma/client";

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  OPEN: ["ACTIVE", "CLOSED"],
  ACTIVE: ["CLOSING"],
  CLOSING: ["CLOSED"],
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
      closedAt: status === "CLOSING" || status === "CLOSED" ? new Date() : undefined,
    },
  });

  return NextResponse.json(updated);
}

// GET /api/sessions/[id] — session detayı
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
