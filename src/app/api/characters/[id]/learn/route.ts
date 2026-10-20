import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { rulesData } from "@/lib/shz/content";
import { learnState } from "@/lib/shz/rules";

/** 1 yetenek puanı harcayarak yetenek açar veya seviyesini artırır. */
export const POST = route({ body: z.object({ ability: z.string().max(80) }), limit: 30 }, async ({ params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "SHZ");
  const data = rulesData();
  const st = learnState(c, body.ability, data);
  if (st.state === "maxed") throw bad("Yetenek zaten en üst seviyede.");
  if (st.state === "locked") throw bad(st.problems.join(" · "));
  const upd = await db
    .update(characters)
    .set({ abilities: { ...c.abilities, [body.ability]: st.nextLevel }, abilityPoints: c.abilityPoints - 1 })
    .where(and(eq(characters.id, c.id), eq(characters.abilityPoints, c.abilityPoints)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  const ab = data.abilities[body.ability];
  await addLog(c.id, user.id, "ability", st.nextLevel === 1 ? `Yetenek açıldı: ${ab.name}` : `${ab.name} seviye ${st.nextLevel}`);
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
