import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectCycle } from "@/lib/cycle-detection";

// POST /api/gamesets/[id]/skill-tree/validate
export async function POST(
  _req: Request,
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

  const nodes = await prisma.skillTreeNode.findMany({
    where: { gamesetId: id },
    select: { id: true, name: true, prerequisites: true, classId: true },
  });

  const errors: string[] = [];

  // 1. Döngü kontrolü
  const cycle = detectCycle(nodes);
  if (cycle.hasCycle) {
    errors.push(`Döngü tespit edildi: ${cycle.path?.join(" → ")}`);
  }

  // 2. Geçersiz prerequisite referansları
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    for (const prereqId of node.prerequisites) {
      if (!nodeIds.has(prereqId)) {
        errors.push(`"${node.name}" geçersiz bir prerequisite referansı içeriyor: ${prereqId}`);
      }
    }
  }

  // 3. Sınıf ağacı prerequisite'leri sınıf dışına referans vermemeli
  for (const node of nodes) {
    if (!node.classId) continue;
    for (const prereqId of node.prerequisites) {
      const prereqNode = nodes.find((n) => n.id === prereqId);
      if (prereqNode && prereqNode.classId && prereqNode.classId !== node.classId) {
        errors.push(
          `"${node.name}" farklı bir sınıf ağacından prerequisite alıyor.`
        );
      }
    }
  }

  return NextResponse.json({
    valid: errors.length === 0,
    errors,
    nodeCount: nodes.length,
  });
}
