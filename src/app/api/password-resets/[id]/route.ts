import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { bad, forbidden, notFound, route } from "@/lib/api";
import { sha256 } from "@/lib/auth/core";
import { inviteCode, normalizeCode } from "@/lib/codes";
import { RESET_CODE_TTL_MS, canApproveReset } from "@/lib/password-resets";

/**
 * GM ya da site yöneticisi şifre sıfırlama isteğini onaylar (tek kullanımlık kod üretilir, yalnızca bir kez gösterilir)
 * veya reddeder. Onaylı bir istekte yeniden onay yeni kod üretir (eski kod geçersizleşir).
 */
export const POST = route({ body: z.object({ action: z.enum(["approve", "deny"]) }), limit: 30 }, async ({ params, body, user }) => {
  const r = await db.query.passwordResets.findFirst({ where: eq(passwordResets.id, params.id) });
  if (!r) throw notFound("İstek bulunamadı.");
  if (!(await canApproveReset(user, r.userId))) throw forbidden("Bu isteği yalnızca oyuncunun GM'i ya da site yöneticisi onaylayabilir.");
  if (r.status !== "PENDING" && r.status !== "APPROVED") throw bad("Bu istek artık açık değil.");
  if (body.action === "deny") {
    await db.update(passwordResets).set({ status: "DENIED", decidedById: user.id, decidedAt: new Date(), codeHash: null }).where(eq(passwordResets.id, r.id));
    return { ok: true };
  }
  const code = inviteCode().replace(/^SHZ-/, "SIF-");
  await db
    .update(passwordResets)
    .set({
      status: "APPROVED",
      decidedById: user.id,
      decidedAt: new Date(),
      codeHash: sha256(normalizeCode(code)),
      codeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    })
    .where(eq(passwordResets.id, r.id));
  return { ok: true, code };
});
