import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function verifyGmOwnership(gamesetId: string, userId: string, role: string) {
  const gameset = await prisma.gameset.findUnique({ where: { id: gamesetId } });
  if (!gameset) return { error: "Gameset bulunamadı.", status: 404 };
  if (gameset.createdById !== userId && role !== "ADMIN") {
    return { error: "Yetkiniz yok.", status: 403 };
  }
  return null;
}

// GET /api/gamesets/[id]/stat-groups
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyGmOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const groups = await prisma.statGroup.findMany({
    where: { gamesetId: id },
    orderBy: { sortOrder: "asc" },
    include: { definitions: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(groups);
}

// POST /api/gamesets/[id]/stat-groups
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;
  const err = await verifyGmOwnership(id, session.user.id, session.user.role);
  if (err) return NextResponse.json({ error: err.error }, { status: err.status });

  const { name, icon, sortOrder } = await req.json();
  if (!name) return NextResponse.json({ error: "Grup adı zorunludur." }, { status: 400 });

  const group = await prisma.statGroup.create({
    data: {
      gamesetId: id,
      name,
      icon: icon || "",
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
