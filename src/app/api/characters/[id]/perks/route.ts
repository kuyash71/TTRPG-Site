import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, forbidden, route } from "@/lib/api";
import { addLog, characterAccess, requireSystem } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";
import { getPerk, rulesData } from "@/lib/shz/content";
import { kriegsversehrtLimbs, perkBudget } from "@/lib/shz/rules";

/**
 * Oyuncunun GM izniyle perklerini yeniden düzenlemesi (tek kullanımlık izin).
 * Yeni seçim perk bütçesine uymalı. Fazladan dönüşen stat puanı serbest puan olarak eklenir;
 * daha önce stat'a dönüşmüş puanları geri alan değişiklikler GM'e bırakılır.
 */
export const POST = route({ body: z.object({ perks: z.array(z.string().max(80)).max(40) }), limit: 20 }, async ({ params, body, user }) => {
  const a = await characterAccess(params.id, user);
    requireSystem(a.campaign, "SHZ");
  const c = a.character;
  if (!a.isGM && !(a.isOwner && c.status === "ACTIVE" && c.perkEditAllowed)) throw forbidden("Perk düzenlemek için GM izni gerekli.");
  const next = [...new Set(body.perks)];
  if (next.some((k) => !getPerk(k))) throw bad("Bilinmeyen perk.");
  const data = rulesData();
  const start = a.campaign.startPerkPoints;
  const opts = { limbs: kriegsversehrtLimbs(c.body) };
  const before = perkBudget(c.perks, start, data, opts);
  const after = perkBudget(next, start, data, opts);
  if (after.problems.length) throw bad(after.problems.join(" · "));
  const delta = after.convertible - before.convertible;
  if (delta < 0 && !a.isGM)
    throw bad(`Bu seçim daha önce stat'a dönüştürülmüş ${-delta} puanı geri alır. Daha az pozitif perk seç ya da GM'den iade iste.`);
  const upd = await db
    .update(characters)
    .set({ perks: next, perkEditAllowed: false, freeStatPoints: Math.max(0, c.freeStatPoints + Math.max(0, delta)) })
    .where(and(eq(characters.id, c.id), eq(characters.updatedAt, c.updatedAt)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, sayfayı yenile.");
  const names = (ks: string[]) => ks.map((k) => getPerk(k)?.name ?? k).join(", ") || "yok";
  await addLog(c.id, user.id, "perk", `Perkler düzenlendi: ${names(c.perks)} → ${names(next)}${delta > 0 ? ` (+${delta} serbest stat puanı)` : ""}`);
  characterChanged(a.campaign.id, c.id);
  return { ok: true, freeStatGained: Math.max(0, delta) };
});
