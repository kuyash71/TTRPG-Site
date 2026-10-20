import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { forbidden, route } from "@/lib/api";
import { characterAccess, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";

/** Kozmetik alanlar: ırk, hane & ünvan, inanç, yiyecek (sahibi ya da GM). */
export const PATCH = route(
  {
    limit: 30,
    body: z.object({
      race: z.string().trim().min(2).max(60).optional(),
      house: z.string().trim().min(2).max(80).optional(),
      faith: z.string().trim().max(80).optional(),
      food: z.string().trim().max(120).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "UC");
    if (!a.isGM && !(a.isOwner && !a.isSpectator)) throw forbidden();
    const c = a.character;
    await db
      .update(characters)
      .set({
        ...(body.race !== undefined && { nationality: body.race }),
        ...(body.house !== undefined && { alignment: body.house }),
        uc: { ...c.uc, ...(body.faith !== undefined && { faith: body.faith }), ...(body.food !== undefined && { food: body.food }) },
      })
      .where(eq(characters.id, c.id));
    characterChanged(a.campaign.id, c.id);
    return { ok: true };
  },
);
