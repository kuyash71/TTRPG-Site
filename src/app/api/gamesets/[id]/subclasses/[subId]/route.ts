import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; subId: string }> };

// PATCH /api/gamesets/[id]/subclasses/[subId]
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, subId } = await params;

  const gameset = await prisma.gameset.findUnique({ where: { id } });
  if (!gameset) return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.unlockLevel !== undefined) data.unlockLevel = body.unlockLevel;

  const updated = await prisma.subclass.update({
    where: { id: subId },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/gamesets/[id]/subclasses/[subId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, subId } = await params;

  const gameset = await prisma.gameset.findUnique({ where: { id } });
  if (!gameset) return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  await prisma.subclass.delete({ where: { id: subId } });

  return NextResponse.json({ ok: true });
}
