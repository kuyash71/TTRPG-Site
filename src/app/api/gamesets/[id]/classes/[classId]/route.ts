import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; classId: string }> };

async function verifyOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// PATCH /api/gamesets/[id]/classes/[classId]
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, classId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.hitDie !== undefined) data.hitDie = body.hitDie;
  if (body.iconUrl !== undefined) data.iconUrl = body.iconUrl;

  const updated = await prisma.gameClass.update({
    where: { id: classId },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE /api/gamesets/[id]/classes/[classId]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, classId } = await params;
  const err = await verifyOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  // Sınıfı kullanan karakter var mı kontrol et
  const charCount = await prisma.character.count({ where: { classId } });
  if (charCount > 0) {
    return NextResponse.json(
      { error: "Bu sınıfı kullanan karakterler var, silinemez." },
      { status: 409 }
    );
  }

  await prisma.gameClass.delete({ where: { id: classId } });

  return NextResponse.json({ ok: true });
}
