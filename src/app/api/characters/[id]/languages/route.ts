import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess } from "@/lib/access";
import { cleanLanguages } from "@/lib/languages";
import { characterChanged } from "@/lib/realtime-bus";

/** GM karakterin dillerini ekler / değiştirir (listede olmayan dil de yazılabilir; ilki ana dil). */
export const PATCH = route({ body: z.object({ languages: z.array(z.string().max(60)).max(12) }), limit: 30 }, async ({ params, body, user }) => {
  const a = await characterAccess(params.id, user);
  if (!a.isGM) throw forbidden("Dilleri yalnızca GM düzenleyebilir.");
  const next = cleanLanguages(body.languages);
  const c = a.character;
  if (JSON.stringify(next) === JSON.stringify(c.languages)) return { ok: true };
  await db.update(characters).set({ languages: next }).where(eq(characters.id, c.id));
  await addLog(c.id, user.id, "gm", fmt("GM: diller {from} → {to}", { from: c.languages.join(", ") || "yok", to: next.join(", ") || "yok" }));
  characterChanged(a.campaign.id, c.id);
  return { ok: true };
});
