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
