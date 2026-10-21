import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { bad, forbidden, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess } from "@/lib/access";
import { characterChanged, notifyCampaign } from "@/lib/realtime-bus";

export const POST = route(
  { body: z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() }) },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    if (!a.isGM) throw forbidden();
    if (a.character.status !== "PENDING") throw bad("Karakter onay beklemiyor.");
    await db
      .update(characters)
      .set({ status: body.approve ? "ACTIVE" : "REJECTED", reviewNote: body.note || null })
      .where(and(eq(characters.id, a.character.id), eq(characters.status, "PENDING")));
    await addLog(a.character.id, user.id, "review", body.approve ? fmt("GM karakteri onayladı.") : body.note ? fmt("GM karakteri reddetti: {note}", { note: body.note }) : fmt("GM karakteri reddetti."));
    characterChanged(a.campaign.id, a.character.id);
    notifyCampaign(a.campaign.id, "approvals:changed", {});
    return { ok: true };
  },
);
