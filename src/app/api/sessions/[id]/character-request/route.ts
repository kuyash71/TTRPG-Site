import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseGamesetConfig } from "@/types/gameset-config";
import { calculateAllStats } from "@/lib/stat-engine";
import type { FormulaNode } from "@/lib/stat-engine";

/**
 * POST /api/sessions/[id]/character-request
 * Oyuncu wizard verilerini GM onayına gönderir.
 * Snapshot: { name, raceId, classId, skillAllocations, backstory }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });

  const { id: sessionId } = await params;

  // Session ve gameset kontrolü
  const gameSession = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      players: { select: { userId: true } },
      gameset: {
        include: {
          statDefinitions: true,
          skillTreeNodes: true,
        },
      },
    },
  });

  if (!gameSession) return NextResponse.json({ error: "Session bulunamadı." }, { status: 404 });

  const isPlayer = gameSession.players.some((p) => p.userId === session.user.id);
  if (!isPlayer) return NextResponse.json({ error: "Bu session'da oyuncu değilsiniz." }, { status: 403 });

  // Zaten karakter var mı?
  const existingChar = await prisma.character.findUnique({
    where: { sessionId_userId: { sessionId, userId: session.user.id } },
  });
  if (existingChar) {
    return NextResponse.json({ error: "Bu session'da zaten bir karakteriniz var." }, { status: 409 });
  }

  // Bekleyen istek var mı?
  const pendingRequest = await prisma.characterApprovalRequest.findFirst({
    where: { sessionId, playerId: session.user.id, status: "PENDING" },
  });
  if (pendingRequest) {
    return NextResponse.json({ error: "Zaten bekleyen bir onay isteğiniz var." }, { status: 409 });
  }

  const body = await req.json();
  const { name, raceId, classId, skillAllocations, backstory, customFields } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Karakter adı zorunludur." }, { status: 400 });
  if (!raceId) return NextResponse.json({ error: "Irk seçimi zorunludur." }, { status: 400 });
  if (!classId) return NextResponse.json({ error: "Sınıf seçimi zorunludur." }, { status: 400 });

  // Skill puan doğrulaması
  const config = parseGamesetConfig(gameSession.gameset.config);
  const totalSpent = Object.values(skillAllocations || {}).reduce(
    (sum: number, levels: unknown) => sum + (levels as number),
    0
  );
  if (totalSpent > config.startingSkillPoints) {
    return NextResponse.json(
      { error: `Çok fazla skill puanı harcandı. Limit: ${config.startingSkillPoints}` },
      { status: 400 }
    );
  }

  // Stat önizlemesi hesapla (snapshot'a ekle)
  const unlocks = Object.entries(skillAllocations || {})
    .filter(([, lvl]) => (lvl as number) > 0)
    .map(([nodeId, lvl]) => ({ nodeId, currentLevel: lvl as number }));

  const nodes = gameSession.gameset.skillTreeNodes.map((n) => ({
    id: n.id,
    statBonusesPerLevel: n.statBonusesPerLevel as Record<string, number>,
  }));

  const statDefs = gameSession.gameset.statDefinitions.map((d) => ({
    key: d.key,
    label: d.label,
    type: d.type as "BASE" | "DERIVED" | "RESOURCE",
    formula: d.formula as FormulaNode | null,
    isPublic: d.isPublic,
    maxVal: d.maxVal,
  }));

  const previewStats = calculateAllStats(statDefs, unlocks, nodes);

  // Custom field doğrulama (max 5)
  const validatedFields = Array.isArray(customFields)
    ? customFields.slice(0, 5).map((f: { id: string; title: string; content: string; isPrivate: boolean }) => ({
        id: f.id,
        title: String(f.title || "").slice(0, 100),
        content: String(f.content || "").slice(0, 2000),
        isPrivate: Boolean(f.isPrivate),
      }))
    : [];

  const snapshot = {
    name: name.trim(),
    raceId,
    classId,
    skillAllocations: skillAllocations || {},
    backstory: backstory || "",
    customFields: validatedFields,
    previewStats: JSON.parse(JSON.stringify(previewStats)),
    spentPoints: totalSpent,
    maxPoints: config.startingSkillPoints,
  };

  const request = await prisma.characterApprovalRequest.create({
    data: {
      sessionId,
      playerId: session.user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snapshot: snapshot as any,
    },
  });

  return NextResponse.json(request, { status: 201 });
}
