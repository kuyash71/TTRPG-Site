import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { characterAccess, requireSystem } from "@/lib/access";
import { bad, forbidden, route } from "@/lib/api";
import { ucClass } from "@/lib/uc/content";
import { ucResolveFaith } from "@/lib/uc/faith";
import { characterChanged } from "@/lib/realtime-bus";

/** Kozmetik alanlar: ırk, hane & unvan, inanç, yiyecek (sahibi ya da GM). */
export const PATCH = route(
  {
    limit: 30,
    body: z.object({
      race: z.string().trim().min(2).max(60).optional(),
      house: z.string().trim().min(2).max(80).optional(),
      faith: z.string().trim().max(80).optional(),
      faithKey: z.string().trim().max(120).optional(),
      faithDetail: z.string().trim().max(60).optional(),
      food: z.string().trim().max(120).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "UC");
    if (!a.isGM && !(a.isOwner && !a.isSpectator)) throw forbidden();
    const c = a.character;
    const faiths = ucClass(c.uc?.classKey ?? "")?.faiths;
    let faithPatch: Record<string, string> = body.faith !== undefined ? { faith: body.faith } : {};
    if (faiths?.length) {
      // İnanç seçen sınıfta (Priest) yalnızca kasadaki inançlar geçerlidir; serbest metin yok sayılır.
      faithPatch = {};
      if (body.faithKey !== undefined) {
        const pick = ucResolveFaith(faiths, body.faithKey, body.faithDetail ?? "");
        if (!pick) throw bad("İnanç seçimi eksik ya da geçersiz.");
        faithPatch = { faith: pick.label, faithKey: body.faithKey, faithDetail: (body.faithDetail ?? "").trim() };
      }
    }
    await db
      .update(characters)
      .set({
        ...(body.race !== undefined && { nationality: body.race }),
        ...(body.house !== undefined && { alignment: body.house }),
        uc: { ...c.uc, ...faithPatch, ...(body.food !== undefined && { food: body.food }) },
      })
      .where(eq(characters.id, c.id));
    characterChanged(a.campaign.id, c.id);
    return { ok: true };
  },
);
