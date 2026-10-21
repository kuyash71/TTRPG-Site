import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/db";
import { characters, portraits } from "@/db/schema";
import { bad, forbidden, notFound, route } from "@/lib/api";
import { fmt } from "@/i18n/core";
import { addLog, characterAccess } from "@/lib/access";
import { characterChanged } from "@/lib/realtime-bus";

export const runtime = "nodejs";

const MAX_BYTES = 400 * 1024; // istemci 512 px'e küçültüp gönderir
const W = 400;
const H = 500;

function sniff(b: Buffer) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Portreyi döndürür (kampanyadaki herkes görebilir). */
export const GET = route({ limit: 600 }, async ({ params, user }) => {
  await characterAccess(params.id, user);
  const p = await db.query.portraits.findFirst({ where: eq(portraits.characterId, params.id) });
  if (!p) throw notFound();
  return new Response(new Uint8Array(p.data), {
    headers: {
      "content-type": "image/webp",
      "cache-control": "private, max-age=604800, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
});

/** Portre yükler: görsel sunucuda yeniden kodlanır (meta veriler ve gizli içerik atılır). */
export const PUT = route(
  { limit: 10, maxBody: 600 * 1024, body: z.object({ image: z.string().max(600 * 1024) }) },
  async ({ params, body, user }) => {
    const a = await characterAccess(params.id, user);
    if (!a.isGM && !a.isOwner) throw forbidden();
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m) throw bad("Görsel PNG, JPEG veya WebP olmalı.");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > MAX_BYTES) throw bad("Görsel çok büyük.");
    if (!sniff(buf)) throw bad("Görsel tanınmadı.");
    let out: Buffer;
    try {
      out = await sharp(buf, { limitInputPixels: 40_000_000, failOn: "error" })
        .rotate()
        .resize(W, H, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw bad("Görsel işlenemedi.");
    }
    await db
      .insert(portraits)
      .values({ characterId: a.character.id, data: out })
      .onConflictDoUpdate({ target: portraits.characterId, set: { data: out, updatedAt: new Date() } });
    await db
      .update(characters)
      .set({ portraitVersion: sql`${characters.portraitVersion} + 1` })
      .where(eq(characters.id, a.character.id));
    await addLog(a.character.id, user.id, "portrait", fmt("Portre güncellendi."));
    characterChanged(a.campaign.id, a.character.id);
    return { ok: true };
  },
);

export const DELETE = route({ limit: 10 }, async ({ params, user }) => {
  const a = await characterAccess(params.id, user);
  if (!a.isGM && !a.isOwner) throw forbidden();
  await db.delete(portraits).where(eq(portraits.characterId, a.character.id));
  await db.update(characters).set({ portraitVersion: 0 }).where(eq(characters.id, a.character.id));
  characterChanged(a.campaign.id, a.character.id);
  return { ok: true };
});
