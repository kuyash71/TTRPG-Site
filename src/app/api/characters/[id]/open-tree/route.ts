import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { badLoose } from "@/lib/api-loose";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { getTree, rulesData } from "@/lib/shz/content";
import { canOpenTree } from "@/lib/shz/rules";

export const POST = route({ body: z.object({ tree: z.string().max(60) }), limit: 10 }, async ({ req, params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "SHZ");
  const problems = canOpenTree(c, body.tree, rulesData());
  if (problems.length) throw badLoose(req, problems);
  const upd = await db
    .update(characters)
    .set({ trees: [...c.trees, body.tree], abilityPoints: c.abilityPoints - 1 })
    .where(and(eq(characters.id, c.id), eq(characters.abilityPoints, c.abilityPoints)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  await addLog(c.id, user.id, "tree", fmt("Yeni ekspertiz ağacı: {name}", { name: getTree(body.tree)?.name }));
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
