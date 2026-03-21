import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; classId: string }> };

// POST /api/gamesets/[id]/classes/[classId]/subclasses
export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id, classId } = await params;

  const gameset = await prisma.gameset.findUnique({ where: { id } });
  if (!gameset) return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { name, description, unlockLevel } = await req.json();
  if (!name) return NextResponse.json({ error: "Alt sınıf adı zorunludur." }, { status: 400 });

  const subclass = await prisma.subclass.create({
    data: {
      classId,
      gamesetId: id,
      name,
      description: description || "",
      unlockLevel: unlockLevel ?? 3,
    },
  });

  return NextResponse.json(subclass, { status: 201 });
}
