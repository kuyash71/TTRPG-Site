import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { BANDAGES, BANDAGE_KEYS, BODY_PART_KEYS, WOUNDS, WOUND_KEYS, bodyPartLabel } from "@/lib/shz/constants";
import { getAugment } from "@/lib/shz/content";
import { normalizeBody } from "@/lib/shz/rules";

/** Uzuv durumu ve augment takma/çıkarma (yalnızca GM). */
export const PATCH = route(
  {
    limit: 120,
    body: z.object({
      part: z.enum(BODY_PART_KEYS as [string, ...string[]]),
      wound: z.enum(WOUND_KEYS as [string, ...string[]]).optional(),
      bandage: z.enum(BANDAGE_KEYS as [string, ...string[]]).optional(),
      augment: z.string().max(80).nullable().optional(),
      note: z.string().trim().max(200).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "SHZ");
    if (!a.isGM) throw forbidden();
    const c = a.character;
    const all = normalizeBody(c.body);
    const part = all[body.part as keyof typeof all];
    const log: string[] = [];
    if (body.wound && body.wound !== part.wound) {
      log.push(`yara: ${WOUNDS.find((w) => w.key === part.wound)?.label} → ${WOUNDS.find((w) => w.key === body.wound)?.label}`);
      part.wound = body.wound as typeof part.wound;
      if (part.wound === "saglam") part.bandage = "yok";
    }
    if (body.bandage && body.bandage !== part.bandage) {
      log.push(`sargı: ${BANDAGES.find((b) => b.key === body.bandage)?.label}`);
      part.bandage = body.bandage as typeof part.bandage;
    }
    if (body.augment !== undefined && body.augment !== part.augment) {
      if (body.augment) {
        const aug = getAugment(body.augment);
        if (!aug) throw bad("Bilinmeyen augment.");
        if (!aug.slots.includes(body.part as never)) throw bad(`${aug.name} bu uzva takılamaz.`);
        log.push(`augment takıldı: ${aug.name}`);
      } else log.push(`augment çıkarıldı: ${getAugment(part.augment ?? "")?.name ?? part.augment}`);
      part.augment = body.augment;
    }
    if (body.note !== undefined) part.note = body.note;
    await db.update(characters).set({ body: all }).where(eq(characters.id, c.id));
    if (log.length) await addLog(c.id, user.id, "body", `${bodyPartLabel(body.part)}: ${log.join(", ")}`);
    characterChanged(a.campaign.id, c.id);
    return { ok: true };
  },
);
