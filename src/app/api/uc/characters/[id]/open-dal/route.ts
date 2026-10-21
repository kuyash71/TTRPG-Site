import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { badLoose } from "@/lib/api-loose";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { asUcChar, ucStatsColumn } from "@/lib/uc/char";
import { UC_STAT_LABELS } from "@/lib/uc/constants";
import { ucRulesData } from "@/lib/uc/content";
import { UC_STAT_MAX, ucOpenDalProblems } from "@/lib/uc/rules";

/**
 * Katman açıldığında (Sv 5: K2, Sv 10: K3) o katmanın iki dalından birini seçer.
 * Dal seçilmeden kazanılmış sembol stat puanları dalın stat'ına eklenir (10'daysa serbest puana döner).
 */
export const POST = route({ body: z.object({ dal: z.string().max(60) }), limit: 10 }, async ({ req, params, body, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  requireSystem(campaign, "UC");
  const data = ucRulesData();
  const ch = asUcChar(c);
  const problems = ucOpenDalProblems(ch, body.dal, data);
  if (problems.length) throw badLoose(req, problems);
  const d = data.dals[body.dal];
  const stats = { ...ch.stats };
  let free = c.freeStatPoints;
  const pend = c.uc?.pendingSymbol ?? 0;
  let toStat = 0;
  for (let i = 0; i < pend; i++) {
    if (stats[d.stat] < UC_STAT_MAX) {
      stats[d.stat]++;
      toStat++;
    } else free++;
  }
  const upd = await db
    .update(characters)
    .set({ trees: [...c.trees, d.key], stats: ucStatsColumn(stats), freeStatPoints: free, uc: { ...c.uc, pendingSymbol: 0 } })
    .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  await addLog(
    c.id,
    user.id,
    "tree",
    [
      fmt("K{tier} dalı seçildi: {name}", { tier: d.tier, name: d.name }),
      ...(toStat ? [fmt("bekleyen sembol puanı: {stat} +{n}", { stat: UC_STAT_LABELS[d.stat], n: toStat })] : []),
      ...(pend > toStat ? [fmt("{n} serbest puan", { n: pend - toStat })] : []),
    ].join(" · "),
  );
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
