import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// GET /api/gamesets/[id]/spells
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const spells = await prisma.spellDefinition.findMany({
    where: { gamesetId: id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(spells);
}

// POST /api/gamesets/[id]/spells
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Büyü adı zorunludur." }, { status: 400 });
  }

  const spell = await prisma.spellDefinition.create({
    data: {
      gamesetId: id,
      name: body.name.trim(),
      description: body.description || "",
      manaCost: body.manaCost ?? 0,
      cooldown: body.cooldown ?? 0,
      range: body.range ?? 0,
      targetType: body.targetType || "SINGLE",
      effects: body.effects || [],
      iconUrl: body.iconUrl || null,
      requiredLevel: body.requiredLevel ?? 1,
    },
  });

  return NextResponse.json(spell, { status: 201 });
}
