import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { BANDAGES, BANDAGE_KEYS, BODY_PART_KEYS, WOUNDS, WOUND_KEYS, bodyPartLabel } from "@/lib/shz/constants";
import { normalizeBody } from "@/lib/shz/rules";

/** Uzuv durumu (yalnızca GM). Umbra Caelis'te augment yoktur; protez notla işaretlenir. */
export const PATCH = route(
  {
    limit: 120,
    body: z.object({
      part: z.enum(BODY_PART_KEYS as [string, ...string[]]),
      wound: z.enum(WOUND_KEYS as [string, ...string[]]).optional(),
      bandage: z.enum(BANDAGE_KEYS as [string, ...string[]]).optional(),
      note: z.string().trim().max(200).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "UC");
    if (!a.isGM) throw forbidden();
    const c = a.character;
    const all = normalizeBody(c.body);
    const part = all[body.part as keyof typeof all];
    const log: string[] = [];
    if (body.wound && body.wound !== part.wound) {
      log.push(fmt("yara: {from} → {to}", { from: WOUNDS.find((w) => w.key === part.wound)?.label, to: WOUNDS.find((w) => w.key === body.wound)?.label }));
      part.wound = body.wound as typeof part.wound;
      if (part.wound === "saglam") part.bandage = "yok";
    }
    if (body.bandage && body.bandage !== part.bandage) {
      log.push(fmt("sargı: {label}", { label: BANDAGES.find((b) => b.key === body.bandage)?.label }));
      part.bandage = body.bandage as typeof part.bandage;
    }
    if (body.note !== undefined) part.note = body.note;
    await db.update(characters).set({ body: all }).where(eq(characters.id, c.id));
    if (log.length) await addLog(c.id, user.id, "body", `${bodyPartLabel(body.part)}: ${log.join(", ")}`);
    characterChanged(a.campaign.id, c.id);
    return { ok: true };
  },
);
