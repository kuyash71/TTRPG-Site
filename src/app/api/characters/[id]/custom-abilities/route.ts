import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters, type CustomAbility } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";

const MAX = 24;
const text = (n: number) => z.string().trim().max(n).default("");
const shape = z.object({
  id: z.string().max(60).optional(),
  name: z.string().trim().min(2).max(80),
  icon: z.string().trim().max(60).default("type:Aktif"),
  type: z.enum(["Aktif", "Pasif", "Tepki"]),
  maxLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  level: z.number().int().min(0).max(3),
  levels: z.array(z.string().trim().max(2000)).min(1).max(3),
  requirement: text(300),
  cost: text(600),
  synergy: text(600),
  note: text(1000),
  flavor: text(500),
});

/** GM'in karaktere özel yeteneği: ekle ya da güncelle (id varsa). Puan harcatmaz; her iki sistemde çalışır. */
export const POST = route({ limit: 60, body: shape }, async ({ params, body, user }) => {
  const a = await characterAccess(params.id, user);
  if (!a.isGM) throw forbidden();
  const c = a.character;
  if (body.levels.length !== body.maxLevel) throw bad("Her seviye için bir açıklama yazılmalı.");
  if (body.level > body.maxLevel) throw bad("Mevcut seviye en yüksek seviyeyi geçemez.");
  const list = [...(c.customAbilities ?? [])];
  const item: CustomAbility = { ...body, id: body.id ?? randomUUID() };
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else {
    if (body.id) throw bad("Yetenek bulunamadı.");
    if (list.length >= MAX) throw bad("En fazla {n} özel yetenek eklenebilir.", { n: MAX });
    list.push(item);
  }
  await db.update(characters).set({ customAbilities: list }).where(eq(characters.id, c.id));
  await addLog(c.id, user.id, "custom", i >= 0
      ? fmt("Özel yetenek güncellendi: {name} (Sv {level}/{max})", { name: item.name, level: item.level, max: item.maxLevel })
      : fmt("Özel yetenek eklendi: {name}", { name: item.name }));
  characterChanged(a.campaign.id, c.id);
  return { ok: true, id: item.id };
});

export const DELETE = route({ limit: 60, body: z.object({ id: z.string().max(60) }) }, async ({ params, body, user }) => {
  const a = await characterAccess(params.id, user);
  if (!a.isGM) throw forbidden();
  const c = a.character;
  const item = (c.customAbilities ?? []).find((x) => x.id === body.id);
  if (!item) throw bad("Yetenek bulunamadı.");
  await db
    .update(characters)
    .set({ customAbilities: c.customAbilities.filter((x) => x.id !== body.id) })
    .where(eq(characters.id, c.id));
  await addLog(c.id, user.id, "custom", fmt("Özel yetenek silindi: {name}", { name: item.name }));
  characterChanged(a.campaign.id, c.id);
  return { ok: true };
});
