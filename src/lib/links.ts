// Sisteme göre sayfa adresleri. Schwarzesonne sayfaları uygulama alt yolunda (/schwarzesonne, next/link ekler),
// Umbra Caelis sayfaları /umbracaelis altındadır ve düz <a> / tam sayfa geçişiyle açılır.
import type { GameSystem } from "../db/schema";

export type Sys = GameSystem;

export const panelHref = (sys: Sys) => (sys === "UC" ? "/umbracaelis/panel" : "/panel");
export const campaignHref = (sys: Sys, id: string) => (sys === "UC" ? `/umbracaelis/kampanya/${id}` : `/kampanya/${id}`);
export const roomHref = (sys: Sys, id: string) => `${campaignHref(sys, id)}/oda`;
export const createCharHref = (sys: Sys, id: string) => `${campaignHref(sys, id)}/karakter-olustur`;
export const characterHref = (sys: Sys, id: string) => (sys === "UC" ? `/umbracaelis/karakter/${id}` : `/karakter/${id}`);

/** Uygulama alt yolunun dışında mı (next/link ve router kullanılamaz)? */
export const isOutsideApp = (href: string) => href.startsWith("/umbracaelis");
