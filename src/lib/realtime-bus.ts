import "server-only";
import type { Server } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var __shzIO: Server | undefined;
  /** server/realtime.ts kurar: kapatılan odanın bellek içi durumunu ve soket üyeliklerini temizler. */
  // eslint-disable-next-line no-var
  var __shzCloseRoom: ((campaignId: string) => void) | undefined;
}

/** API uçlarından oyun odasına bildirim (aynı süreçteki Socket.io sunucusu). */
export function notifyCampaign(campaignId: string, event: string, payload: unknown) {
  globalThis.__shzIO?.to(`c:${campaignId}`).emit(event, payload);
}
export function characterChanged(campaignId: string, characterId: string) {
  notifyCampaign(campaignId, "character:changed", { characterId });
}
/** Tek bir kullanıcının tüm açık bağlantılarına bildirim. */
export function notifyUser(userId: string, event: string, payload: unknown) {
  globalThis.__shzIO?.to(`user:${userId}`).emit(event, payload);
}
/** Oda kapatıldı: açık bağlantılara haber ver, sonra soketleri odadan çıkar ve bekleyen istekleri düşür. */
export function closeCampaignRoom(campaignId: string, campaignName: string) {
  notifyCampaign(campaignId, "campaign:closed", { campaignId, campaignName });
  globalThis.__shzCloseRoom?.(campaignId);
}
