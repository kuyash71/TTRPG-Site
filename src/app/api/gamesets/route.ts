import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/gamesets — GM'in gameset'lerini listele
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  if (session.user.role !== "GM" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const gamesets = await prisma.gameset.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(gamesets);
}

// POST /api/gamesets — yeni gameset oluştur
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  if (session.user.role !== "GM" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { name, description } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Gameset adı zorunludur." },
      { status: 400 }
    );
  }

  const gameset = await prisma.gameset.create({
    data: {
      name,
      description: description || "",
      createdById: session.user.id,
    },
  });

  return NextResponse.json(gameset, { status: 201 });
}
