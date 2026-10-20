import { z } from "zod";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { bad, route } from "@/lib/api";
import { joinCode } from "@/lib/codes";
import { LEVEL_CAP_MAX } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";

const campaignFields = z.object({
  name: z.string().trim().min(2).max(80),
  contentKey: z.string().max(80).nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  startPerkPoints: z.number().int().min(0).max(10),
  levelCap: z.number().int().min(1).max(LEVEL_CAP_MAX),
  deathSaveEnabled: z.boolean(),
  physicalDice: z.boolean().default(false),
  system: z.enum(["SHZ", "UC"]).default("SHZ"),
});

export const POST = route({ auth: "gm", body: campaignFields, limit: 20 }, async ({ body, user }) => {
  if (body.contentKey && (body.system === "UC" || !content().campaigns.some((c) => c.key === body.contentKey))) throw bad("Bilinmeyen kampanya.");
  const [c] = await db
    .insert(campaigns)
    .values({
      name: body.name,
      contentKey: body.contentKey ?? null,
      description: body.description ?? "",
      startPerkPoints: body.startPerkPoints,
      levelCap: body.levelCap,
      deathSaveEnabled: body.deathSaveEnabled,
      physicalDice: body.physicalDice,
      system: body.system,
      gmId: user.id,
      joinCode: joinCode(),
    })
    .returning({ id: campaigns.id });
  return { id: c.id };
});
