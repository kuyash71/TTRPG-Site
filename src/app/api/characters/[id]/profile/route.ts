import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";

/**
 * Karakterin adını ve açıklamalarını (geçmiş, görünüş) değiştirir.
 * Karakterin sahibi (onay bekleyen veya ölü olsa da) ve kampanyanın GM'i yapabilir; izleyiciler yapamaz.
 */
export const PATCH = route(
  {
    limit: 30,
    body: z.object({
      name: z.string().trim().min(2, "İsim en az 2 karakter olmalı.").max(60, "İsim en fazla 60 karakter olabilir.").optional(),
      background: z.string().trim().max(4000).optional(),
      appearance: z.string().trim().max(1000).optional(),
    }),
  },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    if (!a.isGM && !a.isOwner) throw forbidden();
    if (!a.isGM && a.isSpectator) throw forbidden("İzleyiciler karakter üzerinde işlem yapamaz.");
    const c = a.character;

    const set: Partial<Pick<typeof c, "name" | "background" | "appearance">> = {};
    if (body.name !== undefined && body.name !== c.name) set.name = body.name.replace(/\s+/g, " ");
    if (body.background !== undefined && body.background !== c.background) set.background = body.background;
    if (body.appearance !== undefined && body.appearance !== c.appearance) set.appearance = body.appearance;
    if (!Object.keys(set).length) throw bad("Değişiklik yok.");

    await db.update(characters).set(set).where(eq(characters.id, c.id));

    const parts: string[] = [];
    if (set.name) parts.push(fmt("isim: {from} → {to}", { from: c.name, to: set.name }));
    if (set.background !== undefined) parts.push(fmt("geçmiş güncellendi"));
    if (set.appearance !== undefined) parts.push(fmt("görünüş güncellendi"));
    await addLog(c.id, user.id, a.isGM && !a.isOwner ? "gm" : "profile", fmt("Profil: {changes}", { changes: parts.join(", ") }));

    characterChanged(a.campaign.id, c.id);
    return { ok: true, name: set.name ?? c.name };
  },
);
