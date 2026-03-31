import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST — Karakter oluştur
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, name } = await req.json();

  if (!sessionId || !name?.trim()) {
    return NextResponse.json(
      { error: "sessionId ve name gerekli." },
      { status: 400 }
    );
  }

  // Verify user is a player in this session
  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { players: { select: { userId: true } } },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  }

  const isGm = gameSession.gmId === session.user.id;
  const isPlayer = gameSession.players.some(
    (p) => p.userId === session.user.id
  );

  if (!isGm && !isPlayer) {
    return NextResponse.json({ error: "Bu session'a erişiminiz yok." }, { status: 403 });
  }

  // Check if user already has a character in this session
  const existing = await prisma.character.findUnique({
    where: { sessionId_userId: { sessionId, userId: session.user.id } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Bu session'da zaten bir karakteriniz var." },
      { status: 409 }
    );
  }

  const character = await prisma.character.create({
    data: {
      sessionId,
      userId: session.user.id,
      name: name.trim(),
      // Default stats
      stats: {
        create: [
          { name: "HP", baseValue: 100, currentValue: 100, maxValue: 100, isPublic: true },
          { name: "Mana", baseValue: 50, currentValue: 50, maxValue: 50, isPublic: true },
          { name: "STR", baseValue: 10, currentValue: 10, isPublic: false },
          { name: "DEX", baseValue: 10, currentValue: 10, isPublic: false },
          { name: "INT", baseValue: 10, currentValue: 10, isPublic: false },
          { name: "WIS", baseValue: 10, currentValue: 10, isPublic: false },
          { name: "CON", baseValue: 10, currentValue: 10, isPublic: false },
          { name: "CHA", baseValue: 10, currentValue: 10, isPublic: false },
        ],
      },
      wallet: {
        create: { balances: {} },
      },
    },
    include: { stats: true, wallet: true },
  });

  return NextResponse.json(character, { status: 201 });
}

// GET — Session'daki karakterleri listele
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId gerekli." }, { status: 400 });
  }

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });

  if (!gameSession) {
    return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });
  }

  const isGm = gameSession.gmId === session.user.id;

  const characters = await prisma.character.findMany({
    where: { sessionId },
    include: {
      user: { select: { username: true } },
      stats: true,
      wallet: true,
    },
  });

  // Filter private data: only owner and GM can see private stats
  const filtered = characters.map((char) => ({
    ...char,
    stats:
      isGm || char.userId === session.user.id
        ? char.stats
        : char.stats.filter((s) => s.isPublic),
    privateData:
      isGm || char.userId === session.user.id ? char.privateData : {},
    wallet:
      isGm || char.userId === session.user.id ? char.wallet : null,
  }));

  return NextResponse.json(filtered);
}
