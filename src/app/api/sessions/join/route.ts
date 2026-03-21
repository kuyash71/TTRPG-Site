import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/sessions/join — davet koduyla session'a katıl
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const { inviteCode } = await req.json();

  if (!inviteCode) {
    return NextResponse.json(
      { error: "Davet kodu zorunludur." },
      { status: 400 }
    );
  }

  const gameSession = await prisma.session.findUnique({
    where: { inviteCode: inviteCode.toUpperCase() },
    include: { players: true },
  });

  if (!gameSession) {
    return NextResponse.json(
      { error: "Geçersiz davet kodu." },
      { status: 404 }
    );
  }

  if (gameSession.status !== "OPEN") {
    return NextResponse.json(
      { error: "Bu session artık katılıma açık değil." },
      { status: 400 }
    );
  }

  if (gameSession.gmId === session.user.id) {
    return NextResponse.json(
      { error: "Kendi session'ınıza oyuncu olarak katılamazsınız." },
      { status: 400 }
    );
  }

  const alreadyJoined = gameSession.players.some(
    (p) => p.userId === session.user.id
  );

  if (alreadyJoined) {
    return NextResponse.json(
      { error: "Zaten bu session'a katılmışsınız." },
      { status: 409 }
    );
  }

  await prisma.sessionPlayer.create({
    data: {
      sessionId: gameSession.id,
      userId: session.user.id,
    },
  });

  return NextResponse.json(
    { message: "Session'a başarıyla katıldınız.", sessionId: gameSession.id },
    { status: 201 }
  );
}
