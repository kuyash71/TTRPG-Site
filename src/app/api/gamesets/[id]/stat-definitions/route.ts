import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/gamesets/[id]/stat-definitions
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({ where: { id } });
  if (!gameset) return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { groupId, key, label, type, formula, isPublic, maxVal, sortOrder } =
    await req.json();

  if (!groupId || !key || !label || !type) {
    return NextResponse.json(
      { error: "groupId, key, label ve type zorunludur." },
      { status: 400 }
    );
  }

  if (!["BASE", "DERIVED", "RESOURCE"].includes(type)) {
    return NextResponse.json({ error: "Geçersiz stat tipi." }, { status: 400 });
  }

  const definition = await prisma.statDefinition.create({
    data: {
      gamesetId: id,
      groupId,
      key,
      label,
      type,
      formula: formula ?? null,
      isPublic: isPublic ?? true,
      maxVal: maxVal ?? null,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(definition, { status: 201 });
}
