import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/sessions/[id]/stores/[storeId]/transactions — GM bekleyen işlemleri görür
export async function GET(
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

  const transactions = await prisma.pendingTransaction.findMany({
    where: { storeId, status: "PENDING" },
    include: {
      storeItem: {
        include: {
          itemDefinition: { select: { id: true, name: true, category: true, rarity: true, gridWidth: true, gridHeight: true } },
        },
      },
      character: { select: { id: true, name: true, user: { select: { username: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ transactions });
}

// POST /api/sessions/[id]/stores/[storeId]/transactions — Oyuncu teklif oluşturur
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; storeId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId, storeId } = await params;

  // Oyuncunun bu session'da karakteri var mı?
  const character = await prisma.character.findFirst({
    where: { sessionId, userId: session.user.id },
    include: { wallet: true },
  });
  if (!character) return NextResponse.json({ error: "No character" }, { status: 403 });

  const body = await req.json();
  const { storeItemId, offeredPrice } = body as { storeItemId: string; offeredPrice: Record<string, number> };

  if (!storeItemId || !offeredPrice || typeof offeredPrice !== "object")
    return NextResponse.json({ error: "storeItemId and offeredPrice required" }, { status: 400 });

  // Sanitize: drop non-positive entries
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(offeredPrice)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) cleaned[k] = Math.floor(n);
  }
  if (Object.keys(cleaned).length === 0)
    return NextResponse.json({ error: "Offer must contain at least one currency amount" }, { status: 400 });

  // Mağaza ürünü var mı ve storeId uyuşuyor mu?
  const storeItem = await prisma.storeItem.findFirst({
    where: { id: storeItemId, storeId },
    include: { itemDefinition: { select: { name: true } } },
  });
  if (!storeItem) return NextResponse.json({ error: "Store item not found" }, { status: 404 });

  const tx = await prisma.pendingTransaction.create({
    data: {
      storeId,
      storeItemId,
      characterId: character.id,
      offeredPrice: cleaned,
      status: "PENDING",
    },
    include: {
      storeItem: {
        include: {
          itemDefinition: { select: { id: true, name: true, category: true, rarity: true, gridWidth: true, gridHeight: true } },
        },
      },
      character: { select: { id: true, name: true, user: { select: { username: true } } } },
    },
  });

  return NextResponse.json({ transaction: tx });
}
