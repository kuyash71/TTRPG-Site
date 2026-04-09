import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/gamesets/import — import gameset from JSON
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Giriş yapılmadı." }, { status: 401 });
  }

  if (session.user.role !== "GM" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz JSON formatı." },
      { status: 400 }
    );
  }

  if (data._format !== "umbracaelis-gameset-v1") {
    return NextResponse.json(
      { error: "Desteklenmeyen format. 'umbracaelis-gameset-v1' bekleniyor." },
      { status: 400 }
    );
  }

  if (!data.name || typeof data.name !== "string") {
    return NextResponse.json(
      { error: "Gameset adı (name) zorunludur." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create gameset
      const gameset = await tx.gameset.create({
        data: {
          name: data.name as string,
          description: (data.description as string) ?? "",
          config: (data.config as object) ?? {},
          createdById: session.user.id,
        },
      });

      const gid = gameset.id;

      // 2. Stat groups & definitions
      const statGroups = (data.statGroups as Array<{
        name: string;
        icon: string;
        sortOrder: number;
        definitions: Array<{
          key: string;
          label: string;
          type: string;
          formula: unknown;
          isPublic: boolean;
          maxVal: number | null;
          sortOrder: number;
        }>;
      }>) ?? [];

      for (const sg of statGroups) {
        const group = await tx.statGroup.create({
          data: {
            gamesetId: gid,
            name: sg.name,
            icon: sg.icon ?? "",
            sortOrder: sg.sortOrder ?? 0,
          },
        });

        if (sg.definitions?.length) {
          await tx.statDefinition.createMany({
            data: sg.definitions.map((d) => ({
              gamesetId: gid,
              groupId: group.id,
              key: d.key,
              label: d.label,
              type: d.type as "BASE" | "DERIVED" | "RESOURCE",
              formula: d.formula ?? undefined,
              isPublic: d.isPublic ?? true,
              maxVal: d.maxVal ?? null,
              sortOrder: d.sortOrder ?? 0,
            })),
          });
        }
      }

      // 3. Classes + subclasses → build ref map
      const classRefToId = new Map<string, string>();
      const classes = (data.classes as Array<{
        _ref: string;
        name: string;
        description: string;
        hitDie: number;
        subclasses?: Array<{
          name: string;
          description: string;
          unlockLevel: number;
        }>;
      }>) ?? [];

      for (const c of classes) {
        const created = await tx.gameClass.create({
          data: {
            gamesetId: gid,
            name: c.name,
            description: c.description ?? "",
            hitDie: c.hitDie ?? 8,
          },
        });
        if (c._ref) classRefToId.set(c._ref, created.id);

        if (c.subclasses?.length) {
          await tx.subclass.createMany({
            data: c.subclasses.map((s) => ({
              gamesetId: gid,
              classId: created.id,
              name: s.name,
              description: s.description ?? "",
              unlockLevel: s.unlockLevel ?? 3,
            })),
          });
        }
      }

      // 4. Races
      const races = (data.races as Array<{
        name: string;
        description: string;
        racialTraits: unknown;
      }>) ?? [];

      if (races.length) {
        await tx.race.createMany({
          data: races.map((r) => ({
            gamesetId: gid,
            name: r.name,
            description: r.description ?? "",
            racialTraits: r.racialTraits ?? [],
          })),
        });
      }

      // 5. Spells → build ref map
      const spellRefToId = new Map<string, string>();
      const spells = (data.spells as Array<{
        _ref: string;
        name: string;
        description: string;
        manaCost: number;
        cooldown: number;
        range: number;
        targetType: string;
        effects: unknown;
        iconUrl: string | null;
        requiredLevel: number;
      }>) ?? [];

      for (const s of spells) {
        const created = await tx.spellDefinition.create({
          data: {
            gamesetId: gid,
            name: s.name,
            description: s.description ?? "",
            manaCost: s.manaCost ?? 0,
            cooldown: s.cooldown ?? 0,
            range: s.range ?? 0,
            targetType: (s.targetType as "SELF" | "SINGLE" | "AOE" | "LINE") ?? "SELF",
            effects: s.effects ?? [],
            iconUrl: s.iconUrl ?? null,
            requiredLevel: s.requiredLevel ?? 1,
          },
        });
        if (s._ref) spellRefToId.set(s._ref, created.id);
      }

      // 6. Items
      const items = (data.items as Array<{
        name: string;
        description: string;
        category: string;
        gridWidth: number;
        gridHeight: number;
        equipmentSlot: string | null;
        statBonuses: unknown;
        price: unknown;
        stackable: boolean;
        maxStack: number;
        rarity: string;
        iconUrl: string | null;
      }>) ?? [];

      if (items.length) {
        await tx.itemDefinition.createMany({
          data: items.map((i) => ({
            gamesetId: gid,
            name: i.name,
            description: i.description ?? "",
            category: (i.category as "WEAPON" | "ARMOR" | "CONSUMABLE" | "MATERIAL" | "QUEST" | "MISC") ?? "MISC",
            gridWidth: i.gridWidth ?? 1,
            gridHeight: i.gridHeight ?? 1,
            equipmentSlot: i.equipmentSlot as "HEAD" | "CHEST" | "LEGS" | "FEET" | "MAIN_HAND" | "OFF_HAND" | "ACCESSORY_1" | "ACCESSORY_2" | null ?? null,
            statBonuses: (i.statBonuses as object) ?? {},
            price: (i.price as object) ?? {},
            stackable: i.stackable ?? false,
            maxStack: i.maxStack ?? 1,
            rarity: (i.rarity as "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY") ?? "COMMON",
            iconUrl: i.iconUrl ?? null,
          })),
        });
      }

      // 7. Skill tree nodes — two-pass: create all, then update prerequisites
      const nodeRefToId = new Map<string, string>();
      const skillTreeNodes = (data.skillTreeNodes as Array<{
        _ref: string;
        name: string;
        description: string;
        nodeType: string;
        maxLevel: number;
        costPerLevel: number;
        unlockLevel: number;
        prerequisites: string[];
        statBonusesPerLevel: unknown;
        effect: unknown;
        class: string | null;
        spell: string | null;
        posX: number;
        posY: number;
      }>) ?? [];

      // Pass 1: create nodes without prerequisites
      for (const n of skillTreeNodes) {
        const created = await tx.skillTreeNode.create({
          data: {
            gamesetId: gid,
            name: n.name,
            description: n.description ?? "",
            nodeType: (n.nodeType as "PASSIVE" | "ACTIVE" | "SPELL_UNLOCK") ?? "PASSIVE",
            maxLevel: n.maxLevel ?? 1,
            costPerLevel: n.costPerLevel ?? 1,
            unlockLevel: n.unlockLevel ?? 1,
            prerequisites: [],
            statBonusesPerLevel: (n.statBonusesPerLevel as object) ?? {},
            effect: n.effect ?? undefined,
            classId: n.class ? classRefToId.get(n.class) ?? null : null,
            spellDefinitionId: n.spell ? spellRefToId.get(n.spell) ?? null : null,
            posX: n.posX ?? 0,
            posY: n.posY ?? 0,
          },
        });
        if (n._ref) nodeRefToId.set(n._ref, created.id);
      }

      // Pass 2: set prerequisites using resolved IDs
      for (const n of skillTreeNodes) {
        if (n.prerequisites?.length && n._ref) {
          const resolvedPrereqs = n.prerequisites
            .map((ref) => nodeRefToId.get(ref))
            .filter((id): id is string => !!id);

          if (resolvedPrereqs.length) {
            await tx.skillTreeNode.update({
              where: { id: nodeRefToId.get(n._ref)! },
              data: { prerequisites: resolvedPrereqs },
            });
          }
        }
      }

      return gameset;
    });

    return NextResponse.json(
      { id: result.id, name: result.name },
      { status: 201 }
    );
  } catch (err) {
    console.error("Gameset import error:", err);
    return NextResponse.json(
      { error: "Import sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}
