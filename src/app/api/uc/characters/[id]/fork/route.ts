import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterEditor, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { UC_FORK_INFO, UC_FORK_LEVELS, ucClampDecay } from "@/lib/uc/rules";

/** Yozlaşma çatalında karar: Teslim ya da Direniş. Kalıcıdır (yalnızca GM değiştirebilir). */
export const POST = route({ body: z.object({ level: z.enum(UC_FORK_LEVELS), choice: z.enum(["teslim", "direnis"]) }), limit: 10 }, async ({ params, body, user }) => {
  const { character: c, campaign, isGM } = await characterEditor(params.id, user);
  requireSystem(campaign, "UC");
  if (c.corruption < Number(body.level)) throw bad("Bu çatala henüz ulaşılmadı.");
  if (c.uc?.forks?.[body.level] && !isGM) throw bad("Bu çatalda karar verildi; kararlar silinmez.");
  const forks = { ...(c.uc?.forks ?? {}), [body.level]: body.choice };
  const upd = await db
    .update(characters)
    .set({ uc: { ...c.uc, forks }, corruption: ucClampDecay(c.corruption, forks) })
    .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  const info = UC_FORK_INFO[body.level];
  await addLog(c.id, user.id, "corruption", body.choice === "teslim"
      ? fmt("{title}: Teslim · {effect}", { title: info.title, effect: info.teslim })
      : fmt("{title}: Direniş · {effect}", { title: info.title, effect: info.direnis }));
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
