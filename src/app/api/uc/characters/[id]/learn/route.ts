import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { badLoose } from "@/lib/api-loose";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { asUcChar, ucUnspent } from "@/lib/uc/char";
import { ucRulesData } from "@/lib/uc/content";
import { ucLearnState } from "@/lib/uc/rules";

/** 1 yetenek puanı harcayarak yetenek açar ya da seviyesini artırır (katman kilidi, Sv 3 kilidi, gereksinimler). */
export const POST = route({ body: z.object({ ability: z.string().max(80) }), limit: 30 }, async ({ req, params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "UC");
  const data = ucRulesData();
  const st = ucLearnState(asUcChar(c), body.ability, data);
  if (st.state === "maxed") throw bad("Yetenek zaten en üst seviyede.");
  if (st.state === "locked") throw badLoose(req, st.problems);
  const abilities = { ...c.abilities, [body.ability]: st.nextLevel };
  const upd = await db
    .update(characters)
    .set({ abilities, abilityPoints: ucUnspent({ level: c.level, abilities }, data) })
    .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  const ab = data.abilities[body.ability];
  await addLog(c.id, user.id, "ability", st.nextLevel === 1
      ? st.usesZirve
        ? fmt("Yetenek açıldı: {name} (Zirve puanı)", { name: ab.name })
        : fmt("Yetenek açıldı: {name}", { name: ab.name })
      : st.usesZirve
        ? fmt("{name} seviye {level} (Zirve puanı)", { name: ab.name, level: st.nextLevel })
        : fmt("{name} seviye {level}", { name: ab.name, level: st.nextLevel }));
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
