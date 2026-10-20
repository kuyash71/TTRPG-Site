import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, conflict, route } from "@/lib/api";
import { addLog, characterEditor } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";

/** Death Save hakkını Inspiration harcayarak yeniler (her yenilemede maliyet 1 artar). */
export const POST = route({ limit: 10 }, async ({ params, user }) => {
  const { character: c, campaign } = await characterEditor(params.id, user);
  if (!campaign.deathSaveEnabled) throw bad("Bu kampanyada Death Save kapalı.");
  const ds = { ...c.deathSave };
  if (ds.available) throw bad("Death Save hakkın zaten var.");
  const cost = ds.resets + 1;
  const pn = campaign.system === "UC" ? "Esin" : "Inspiration";
  if (c.inspiration < cost) throw bad(`Yenilemek için ${cost} ${pn} gerekiyor.`);
  const upd = await db
    .update(characters)
    .set({ inspiration: c.inspiration - cost, deathSave: { ...ds, available: true, resets: ds.resets + 1, deaths: 0, saves: 0 } })
    .where(and(eq(characters.id, c.id), eq(characters.inspiration, c.inspiration)))
    .returning({ id: characters.id });
  if (!upd.length) throw conflict("Karakter bu sırada değişti, tekrar dene.");
  await addLog(c.id, user.id, "death-save", `Death Save ${cost} ${pn} ile yenilendi.`);
  characterChanged(campaign.id, c.id);
  return { ok: true };
});
