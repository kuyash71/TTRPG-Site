import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/gamesets/[id] — gameset detayı (tüm ilişkili verilerle)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({
    where: { id },
    include: {
      statGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          definitions: { orderBy: { sortOrder: "asc" } },
        },
      },
      classes: {
        include: { subclasses: true },
      },
      races: true,
    },
  });

  if (!gameset) {
    return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  }

  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  return NextResponse.json(gameset);
}

// PATCH /api/gamesets/[id] — gameset güncelle (name, description, config)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({ where: { id } });
  if (!gameset) {
    return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  }
  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.config !== undefined) data.config = body.config;

  const updated = await prisma.gameset.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/gamesets/[id] — gameset sil (confirmName gerekli)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giris yapilmadi." }, { status: 401 });
  }

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({
    where: { id },
    include: { sessions: { select: { id: true, status: true } } },
  });

  if (!gameset) {
    return NextResponse.json({ error: "Gameset bulunamadi." }, { status: 404 });
  }

  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const body = await req.json();
  if (body.confirmName !== gameset.name) {
    return NextResponse.json(
      { error: "Onay icin gameset adini dogru yazin." },
      { status: 400 }
    );
  }

  // Check for active sessions
  const activeSessions = gameset.sessions.filter((s) => s.status !== "CLOSED");
  if (activeSessions.length > 0) {
    return NextResponse.json(
      { error: "Aktif session'lar varken gameset silinemez. Once session'lari kapatin." },
      { status: 400 }
    );
  }

  // Cascade delete: gameset and all related data
  // StatGroup, StatDefinition, GameClass, Subclass, Race, SkillTreeNode,
  // ItemDefinition, SpellDefinition all have onDelete: Cascade from gameset
  // But Sessions reference gameset without cascade, so delete sessions first
  for (const s of gameset.sessions) {
    await prisma.$transaction([
      prisma.characterApprovalRequest.deleteMany({ where: { sessionId: s.id } }),
      prisma.chatMessage.deleteMany({ where: { sessionId: s.id } }),
      prisma.diceRoll.deleteMany({ where: { sessionId: s.id } }),
      prisma.characterStat.deleteMany({ where: { character: { sessionId: s.id } } }),
      prisma.characterWallet.deleteMany({ where: { character: { sessionId: s.id } } }),
      prisma.characterSkillUnlock.deleteMany({ where: { character: { sessionId: s.id } } }),
      prisma.characterInventoryItem.deleteMany({ where: { character: { sessionId: s.id } } }),
      prisma.characterSpell.deleteMany({ where: { character: { sessionId: s.id } } }),
      prisma.character.deleteMany({ where: { sessionId: s.id } }),
      prisma.sessionPlayer.deleteMany({ where: { sessionId: s.id } }),
      prisma.session.delete({ where: { id: s.id } }),
    ]);
  }

  // Now delete gameset (cascades to stat groups, classes, races, etc.)
  await prisma.gameset.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
