import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { badLoose } from "@/lib/api-loose";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { ucRulesData } from "@/lib/uc/content";
import { ucPerkBudget } from "@/lib/uc/rules";

/** GM izniyle (tek seferlik) perkleri yeniden düzenleme; fazladan dönüşen puan serbest stat puanı olur. */
export const POST = route({ body: z.object({ perks: z.array(z.string().max(80)).max(40) }), limit: 20 }, async ({ req, params, body, user }) => {
  const a = await characterAccess(params.id, user);
  requireSystem(a.campaign, "UC");
  const c = a.character;
  if (!a.isGM && !(a.isOwner && c.status === "ACTIVE" && c.perkEditAllowed)) throw forbidden("Perk düzenlemek için GM izni gerekli.");
  const data = ucRulesData();
  const next = [...new Set(body.perks)];
  if (next.some((k) => !data.perks.some((p) => p.key === k))) throw bad("Bilinmeyen perk.");
  const start = a.campaign.startPerkPoints;
  const before = ucPerkBudget(c.perks, start, data);
  const after = ucPerkBudget(next, start, data);
  if (after.problems.length) throw badLoose(req, after.problems);
  const delta = after.convertible - before.convertible;
  if (delta < 0 && !a.isGM) throw bad("Bu seçim daha önce stat'a dönüştürülmüş {n} puanı geri alır. GM'den iade iste.", { n: -delta });
  const upd = await db
    .update(characters)
    .set({ perks: next, perkEditAllowed: false, freeStatPoints: Math.max(0, c.freeStatPoints + Math.max(0, delta)) })
    .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  const names = (ks: string[]) => ks.map((k) => data.perks.find((p) => p.key === k)?.name ?? k).join(", ") || "yok";
  await addLog(c.id, user.id, "perk", delta > 0
      ? fmt("Perkler düzenlendi: {from} → {to} (+{n} serbest stat puanı)", { from: names(c.perks), to: names(next), n: delta })
      : fmt("Perkler düzenlendi: {from} → {to}", { from: names(c.perks), to: names(next) }));
  characterChanged(a.campaign.id, c.id);
  return { ok: true, freeStatGained: Math.max(0, delta) };
});
