import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — Karakter detayı
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      user: { select: { username: true } },
      session: { select: { gmId: true, name: true, id: true } },
      stats: true,
      wallet: true,
    },
  });

  if (!character) {
    return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });
  }

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;

  return NextResponse.json({
    ...character,
    stats: isOwner || isGm ? character.stats : character.stats.filter((s) => s.isPublic),
    privateData: isOwner || isGm ? character.privateData : {},
    wallet: isOwner || isGm ? character.wallet : null,
  });
}

// PATCH — Karakter güncelle (sahip veya GM)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const character = await prisma.character.findUnique({
    where: { id },
    include: { session: { select: { gmId: true } } },
  });

  if (!character) {
    return NextResponse.json({ error: "Karakter bulunamadı." }, { status: 404 });
  }

  const isOwner = character.userId === session.user.id;
  const isGm = character.session.gmId === session.user.id;

  if (!isOwner && !isGm) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const body = await req.json();
  const { name, avatarUrl, publicData, privateData, stats, wallet } = body;

  // Update character base fields
  const updated = await prisma.character.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(publicData !== undefined && { publicData }),
      ...((isOwner || isGm) && privateData !== undefined && { privateData }),
    },
    include: { stats: true, wallet: true, user: { select: { username: true } } },
  });

  // Update stats if provided
  if (stats && Array.isArray(stats)) {
    for (const stat of stats) {
      // Only GM can change isPublic
      const statUpdate: Record<string, unknown> = {};
      if (stat.currentValue !== undefined) statUpdate.currentValue = stat.currentValue;
      if (stat.baseValue !== undefined && isGm) statUpdate.baseValue = stat.baseValue;
      if (stat.maxValue !== undefined && isGm) statUpdate.maxValue = stat.maxValue;
      if (stat.isPublic !== undefined && isGm) statUpdate.isPublic = stat.isPublic;

      if (Object.keys(statUpdate).length > 0) {
        await prisma.characterStat.update({
          where: { characterId_name: { characterId: id, name: stat.name } },
          data: statUpdate,
        });
      }
    }

    // Re-fetch stats
    updated.stats = await prisma.characterStat.findMany({
      where: { characterId: id },
    });
  }

  // Update wallet if provided (GM only)
  if (wallet && isGm && updated.wallet) {
    updated.wallet = await prisma.characterWallet.update({
      where: { characterId: id },
      data: {
        ...(wallet.gold !== undefined && { gold: wallet.gold }),
        ...(wallet.silver !== undefined && { silver: wallet.silver }),
        ...(wallet.copper !== undefined && { copper: wallet.copper }),
      },
    });
  }

  return NextResponse.json(updated);
}
