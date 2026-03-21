import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInviteCode } from "@/lib/invite-code";

// GET /api/sessions — kullanıcının session'larını listele
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const { user } = session;

  if (user.role === "GM" || user.role === "ADMIN") {
    // GM: kendi oluşturduğu session'lar
    const sessions = await prisma.session.findMany({
      where: { gmId: user.id },
      include: {
        gameset: { select: { name: true } },
        players: { include: { user: { select: { id: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sessions);
  }

  // USER: katıldığı session'lar
  const playerSessions = await prisma.sessionPlayer.findMany({
    where: { userId: user.id },
    include: {
      session: {
        include: {
          gm: { select: { username: true } },
          gameset: { select: { name: true } },
          players: { include: { user: { select: { id: true, username: true } } } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json(playerSessions.map((sp) => sp.session));
}

// POST /api/sessions — GM yeni session oluşturur
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  if (session.user.role !== "GM" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { name, gamesetId } = await req.json();

  if (!name || !gamesetId) {
    return NextResponse.json(
      { error: "Session adı ve gameset zorunludur." },
      { status: 400 }
    );
  }

  // Gameset var mı kontrol et
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) {
    return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  }

  // Unique invite code üret
  let inviteCode: string;
  let attempts = 0;
  do {
    inviteCode = generateInviteCode();
    const existing = await prisma.session.findUnique({ where: { inviteCode } });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return NextResponse.json(
      { error: "Davet kodu üretilemedi, tekrar deneyin." },
      { status: 500 }
    );
  }

  const newSession = await prisma.session.create({
    data: {
      name,
      inviteCode,
      gmId: session.user.id,
      gamesetId,
    },
    include: {
      gameset: { select: { name: true } },
    },
  });

  return NextResponse.json(newSession, { status: 201 });
}
