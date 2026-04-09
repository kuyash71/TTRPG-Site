import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Generates a URL-safe ref key from a name.
 * Deduplicates by appending _2, _3, etc.
 */
function makeRef(name: string, existing: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/gi, "_")
    .replace(/^_|_$/g, "")
    || "unnamed";

  let ref = base;
  let i = 2;
  while (existing.has(ref)) {
    ref = `${base}_${i}`;
    i++;
  }
  existing.add(ref);
  return ref;
}

// GET /api/gamesets/[id]/export — readable JSON export
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  const { id } = await params;

  const gameset = await prisma.gameset.findUnique({
    where: { id },
    include: {
      statGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          definitions: { orderBy: { sortOrder: "asc" } },
        },
      },
      classes: {
        include: { subclasses: true },
      },
      races: true,
      skillTreeNodes: true,
      itemDefinitions: true,
      spellDefinitions: true,
    },
  });

  if (!gameset) {
    return NextResponse.json({ error: "Gameset bulunamadı." }, { status: 404 });
  }

  if (gameset.createdById !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  // ── Build ref maps (old UUID → readable ref key) ──
  const classRefs = new Set<string>();
  const classIdToRef = new Map<string, string>();
  for (const c of gameset.classes) {
    const ref = makeRef(c.name, classRefs);
    classIdToRef.set(c.id, ref);
  }

  const spellRefs = new Set<string>();
  const spellIdToRef = new Map<string, string>();
  for (const s of gameset.spellDefinitions) {
    const ref = makeRef(s.name, spellRefs);
    spellIdToRef.set(s.id, ref);
  }

  const nodeRefs = new Set<string>();
  const nodeIdToRef = new Map<string, string>();
  for (const n of gameset.skillTreeNodes) {
    const ref = makeRef(n.name, nodeRefs);
    nodeIdToRef.set(n.id, ref);
  }

  // ── Build export object ──
  const exported = {
    _format: "umbracaelis-gameset-v1",
    _exportedAt: new Date().toISOString(),
    name: gameset.name,
    description: gameset.description,
    config: gameset.config,

    statGroups: gameset.statGroups.map((g) => ({
      name: g.name,
      icon: g.icon,
      sortOrder: g.sortOrder,
      definitions: g.definitions.map((d) => ({
        key: d.key,
        label: d.label,
        type: d.type,
        formula: d.formula,
        isPublic: d.isPublic,
        maxVal: d.maxVal,
        sortOrder: d.sortOrder,
      })),
    })),

    classes: gameset.classes.map((c) => ({
      _ref: classIdToRef.get(c.id)!,
      name: c.name,
      description: c.description,
      hitDie: c.hitDie,
      subclasses: c.subclasses.map((s) => ({
        name: s.name,
        description: s.description,
        unlockLevel: s.unlockLevel,
      })),
    })),

    races: gameset.races.map((r) => ({
      name: r.name,
      description: r.description,
      racialTraits: r.racialTraits,
    })),

    spells: gameset.spellDefinitions.map((s) => ({
      _ref: spellIdToRef.get(s.id)!,
      name: s.name,
      description: s.description,
      manaCost: s.manaCost,
      cooldown: s.cooldown,
      range: s.range,
      targetType: s.targetType,
      effects: s.effects,
      iconUrl: s.iconUrl,
      requiredLevel: s.requiredLevel,
    })),

    items: gameset.itemDefinitions.map((i) => ({
      name: i.name,
      description: i.description,
      category: i.category,
      gridWidth: i.gridWidth,
      gridHeight: i.gridHeight,
      equipmentSlot: i.equipmentSlot,
      statBonuses: i.statBonuses,
      price: i.price,
      stackable: i.stackable,
      maxStack: i.maxStack,
      rarity: i.rarity,
      iconUrl: i.iconUrl,
    })),

    skillTreeNodes: gameset.skillTreeNodes.map((n) => ({
      _ref: nodeIdToRef.get(n.id)!,
      name: n.name,
      description: n.description,
      nodeType: n.nodeType,
      maxLevel: n.maxLevel,
      costPerLevel: n.costPerLevel,
      unlockLevel: n.unlockLevel,
      prerequisites: n.prerequisites
        .map((pid) => nodeIdToRef.get(pid))
        .filter(Boolean),
      statBonusesPerLevel: n.statBonusesPerLevel,
      effect: n.effect,
      class: n.classId ? classIdToRef.get(n.classId) ?? null : null,
      spell: n.spellDefinitionId
        ? spellIdToRef.get(n.spellDefinitionId) ?? null
        : null,
      posX: n.posX,
      posY: n.posY,
    })),
  };

  // Return as downloadable JSON
  const filename = `${gameset.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.json`;

  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
