import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// DELETE /api/sessions/[id]/loot/[lootId] — GM loot öğesi siler
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; lootId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId, lootId } = await params;

  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { gmId: true },
  });
  if (!gameSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gameSession.gmId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.sessionLootItem.delete({ where: { id: lootId } });
  return NextResponse.json({ ok: true });
}
