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

// PATCH /api/gamesets/[id]/spells/[spellId]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; spellId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, spellId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();

  const spell = await prisma.spellDefinition.update({
    where: { id: spellId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.manaCost !== undefined && { manaCost: body.manaCost }),
      ...(body.cooldown !== undefined && { cooldown: body.cooldown }),
      ...(body.range !== undefined && { range: body.range }),
      ...(body.targetType !== undefined && { targetType: body.targetType }),
      ...(body.effects !== undefined && { effects: body.effects }),
      ...(body.iconUrl !== undefined && { iconUrl: body.iconUrl || null }),
      ...(body.requiredLevel !== undefined && { requiredLevel: body.requiredLevel }),
    },
  });

  return NextResponse.json(spell);
}

// DELETE /api/gamesets/[id]/spells/[spellId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; spellId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, spellId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  await prisma.spellDefinition.delete({ where: { id: spellId } });

  return NextResponse.json({ ok: true });
}
