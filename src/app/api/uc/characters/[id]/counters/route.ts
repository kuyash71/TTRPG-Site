import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, route } from "@/lib/api";
import { characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { asUcChar } from "@/lib/uc/char";
import { UC_DAL_COUNTERS } from "@/lib/uc/mechanics";

/** Dal mekaniği sayacını ya da notunu günceller (sahibi ya da GM). */
export const PATCH = route(
  {
    limit: 120,
    body: z.object({
      key: z.string().max(40),
      value: z.number().int().min(0).max(99).optional(),
      notes: z.string().max(2000).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const { character: c, campaign } = await characterEditor(params.id, user);
    requireSystem(campaign, "UC");
    const def = c.trees.flatMap((t) => UC_DAL_COUNTERS[t] ?? []).find((d) => d.key === body.key);
    if (!def) throw bad("Bu sayaç karakterin dallarında yok.");
    const u = asUcChar(c);
    const max = def.max?.(u.stats, { corruption: c.corruption, abilities: c.abilities });
    const counters = { ...(c.uc?.counters ?? {}) };
    const dalNotes = { ...(c.uc?.dalNotes ?? {}) };
    if (body.value !== undefined) counters[def.key] = max === undefined ? body.value : Math.min(max, body.value);
    if (body.notes !== undefined) dalNotes[def.key] = body.notes;
    await db
      .update(characters)
      .set({ uc: { ...c.uc, counters, dalNotes } })
      .where(eq(characters.id, c.id));
    characterChanged(campaign.id, c.id);
    return { ok: true, value: counters[def.key] ?? 0 };
  },
);
