import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkCollision, type GridItem } from "@/lib/inventory-grid";

// PATCH /api/sessions/[id]/stores/[storeId]/transactions/[txId] — GM onayla/reddet
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; storeId: string; txId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId, storeId, txId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gameSession.gmId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action } = body as { action: "approve" | "reject" };

  const tx = await prisma.pendingTransaction.findUnique({
    where: { id: txId },
    include: {
      storeItem: { include: { itemDefinition: true } },
      character: { include: { wallet: true, inventoryItems: true } },
    },
  });

  if (!tx || tx.storeId !== storeId)
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (tx.status !== "PENDING")
    return NextResponse.json({ error: "Already processed" }, { status: 409 });

  if (action === "reject") {
    await prisma.pendingTransaction.update({
      where: { id: txId },
      data: { status: "REJECTED" },
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  if (action === "approve") {
    const character = tx.character;
    const wallet = character.wallet;
    const itemDef = tx.storeItem.itemDefinition;

    // Yeterli bakiye var mı?
    const balances = (wallet?.balances as Record<string, number>) ?? {};
    const primaryCurrency = Object.keys(balances)[0] ?? "gold";
    const currentAmount = balances[primaryCurrency] ?? 0;
    if (!wallet || currentAmount < tx.offeredPrice) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 422 });
    }

    // Envanterde boş yer bul
    const existingItems: GridItem[] = character.inventoryItems
      .filter((i) => !i.isEquipped)
      .map((i) => ({
        id: i.id,
        posX: i.posX,
        posY: i.posY,
        gridWidth: itemDef.gridWidth,
        gridHeight: itemDef.gridHeight,
      }));

    // Gameset config'den grid boyutunu al
    const gamesetConfig = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { gameset: { select: { config: true } } },
    });
    const config = (gamesetConfig?.gameset?.config ?? {}) as Record<string, unknown>;
    const gridW = typeof config.inventoryGridWidth === "number" ? config.inventoryGridWidth : 10;
    const gridH = typeof config.inventoryGridHeight === "number" ? config.inventoryGridHeight : 6;

    let posX = 0;
    let posY = 0;
    let placed = false;
    outer: for (let y = 0; y <= gridH - itemDef.gridHeight; y++) {
      for (let x = 0; x <= gridW - itemDef.gridWidth; x++) {
        const placing: GridItem = { id: "new", posX: x, posY: y, gridWidth: itemDef.gridWidth, gridHeight: itemDef.gridHeight };
        if (!checkCollision(existingItems, placing, gridW, gridH)) {
          posX = x;
          posY = y;
          placed = true;
          break outer;
        }
      }
    }

    // Bakiye düş, eşyayı ekle, işlemi kapat
    const newBalances = { ...balances, [primaryCurrency]: currentAmount - tx.offeredPrice };
    const [, newItem] = await prisma.$transaction([
      prisma.characterWallet.update({
        where: { characterId: character.id },
        data: { balances: newBalances },
      }),
      prisma.characterInventoryItem.create({
        data: {
          characterId: character.id,
          itemDefinitionId: itemDef.id,
          posX: placed ? posX : 0,
          posY: placed ? posY : 0,
          quantity: 1,
        },
        include: { itemDefinition: { select: { name: true, category: true, rarity: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, description: true } } },
      }),
      prisma.pendingTransaction.update({
        where: { id: txId },
        data: { status: "APPROVED" },
      }),
    ]);

    return NextResponse.json({ ok: true, status: "APPROVED", newItem });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
