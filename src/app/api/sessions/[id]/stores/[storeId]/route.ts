import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function sanitizePrice(price: unknown): Record<string, number> {
  if (!price || typeof price !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(price as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

// PATCH /api/sessions/[id]/stores/[storeId] — GM mağazayı günceller (isim, aktiflik, ürünler)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; storeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId, storeId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gameSession.gmId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Eğer isActive true yapılıyorsa diğer aktif mağazaları kapat
  if (body.isActive === true) {
    await prisma.store.updateMany({
      where: { sessionId, isActive: true },
      data: { isActive: false },
    });
  }

  // Ürün güncellemesi varsa: sil ve yeniden oluştur
  if (body.items !== undefined) {
    await prisma.storeItem.deleteMany({ where: { storeId } });
    await prisma.storeItem.createMany({
      data: (body.items as { itemDefinitionId: string; basePrice: Record<string, number>; stock?: number | null }[])
        .slice(0, 6)
        .map((i) => ({
          storeId,
          itemDefinitionId: i.itemDefinitionId,
          basePrice: sanitizePrice(i.basePrice),
          stock: i.stock ?? null,
        })),
    });
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      items: {
        include: {
          itemDefinition: {
            select: { id: true, name: true, description: true, category: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, rarity: true, iconUrl: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ store: updated });
}

// DELETE /api/sessions/[id]/stores/[storeId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; storeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId, storeId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gameSession.gmId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.store.delete({ where: { id: storeId } });
  return NextResponse.json({ ok: true });
}
