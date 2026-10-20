import "server-only";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { campaignMembers, campaigns, passwordResets, users } from "../db/schema";
import type { SessionUser } from "./auth/core";

/** Onaylanan sıfırlama kodunun geçerlilik süresi. */
export const RESET_CODE_TTL_MS = 24 * 60 * 60_000;

/**
 * Bir kullanıcının şifre sıfırlama isteğini kimler onaylayabilir:
 * site yöneticileri ve kullanıcının üyesi olduğu kampanyaların GM'leri (kendisi hariç).
 */
export async function resetApproverIds(userId: string) {
  const [admins, gms] = await Promise.all([
    db.select({ id: users.id }).from(users).where(and(eq(users.isAdmin, true), eq(users.disabled, false))),
    db
      .selectDistinct({ id: campaigns.gmId })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaignMembers.userId, userId)),
  ]);
  return [...new Set([...admins.map((a) => a.id), ...gms.map((g) => g.id)])].filter((id) => id !== userId);
}

export async function canApproveReset(approver: SessionUser, targetUserId: string) {
  if (approver.id === targetUserId) return false;
  if (approver.isAdmin) return true;
  const r = await db
    .select({ id: campaigns.id })
    .from(campaignMembers)
    .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
    .where(and(eq(campaignMembers.userId, targetUserId), eq(campaigns.gmId, approver.id)))
    .limit(1);
  return r.length > 0;
}

export interface ResetView {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  status: "PENDING" | "APPROVED";
  createdAt: string;
  codeExpiresAt: string | null;
  campaigns: string[];
}

/** Onaylayanın görebildiği açık istekler (bekleyen ve kodu henüz kullanılmamış onaylılar). */
export async function visibleResets(user: SessionUser): Promise<ResetView[]> {
  const open = or(eq(passwordResets.status, "PENDING"), and(eq(passwordResets.status, "APPROVED"), gt(passwordResets.codeExpiresAt, new Date()), isNull(passwordResets.usedAt)));
  let targetIds: string[] | null = null;
  if (!user.isAdmin) {
    const rows = await db
      .selectDistinct({ id: campaignMembers.userId })
      .from(campaignMembers)
      .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
      .where(eq(campaigns.gmId, user.id));
    targetIds = rows.map((r) => r.id).filter((id) => id !== user.id);
    if (!targetIds.length) return [];
  }
  const rows = await db
    .select({ r: passwordResets, username: users.username, displayName: users.displayName })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(open, targetIds ? inArray(passwordResets.userId, targetIds) : undefined))
    .orderBy(desc(passwordResets.createdAt))
    .limit(50);
  const ids = [...new Set(rows.map((x) => x.r.userId))];
  const camps = ids.length
    ? await db
        .select({ userId: campaignMembers.userId, name: campaigns.name, gmId: campaigns.gmId })
        .from(campaignMembers)
        .innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
        .where(inArray(campaignMembers.userId, ids))
    : [];
  return rows
    .filter((x) => x.r.userId !== user.id)
    .map((x) => ({
      id: x.r.id,
      userId: x.r.userId,
      username: x.username,
      displayName: x.displayName,
      status: x.r.status as "PENDING" | "APPROVED",
      createdAt: x.r.createdAt.toISOString(),
      codeExpiresAt: x.r.codeExpiresAt?.toISOString() ?? null,
      campaigns: camps.filter((c) => c.userId === x.r.userId && (user.isAdmin || c.gmId === user.id)).map((c) => c.name),
    }));
}

/** Gezinme çubuğundaki rozet için: onay bekleyen istek sayısı. */
export async function pendingResetCount(user: SessionUser) {
  if (user.role !== "GM" && !user.isAdmin) return 0;
  return (await visibleResets(user)).filter((r) => r.status === "PENDING").length;
}
