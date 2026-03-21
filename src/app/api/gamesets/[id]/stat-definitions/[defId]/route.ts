import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; defId: string }> };

async function verifyOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// PATCH /api/gamesets/[id]/stat-definitions/[defId]
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, defId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.key !== undefined) data.key = body.key;
  if (body.label !== undefined) data.label = body.label;
  if (body.type !== undefined) data.type = body.type;
  if (body.formula !== undefined) data.formula = body.formula;
  if (body.isPublic !== undefined) data.isPublic = body.isPublic;
  if (body.maxVal !== undefined) data.maxVal = body.maxVal;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.groupId !== undefined) data.groupId = body.groupId;

  const updated = await prisma.statDefinition.update({
    where: { id: defId },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/gamesets/[id]/stat-definitions/[defId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, defId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  await prisma.statDefinition.delete({ where: { id: defId } });

  return NextResponse.json({ ok: true });
}
