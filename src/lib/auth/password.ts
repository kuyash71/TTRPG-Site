import bcrypt from "bcryptjs";
import { fmt } from "../../i18n/core";

const COST = 12;
// Kullanıcı bulunamadığında da aynı süreyi harcamak için sabit bir özet.
const DUMMY = "$2b$12$wDKHa.oO.vdn0/pGgJsCGOEo/qSYlTvx08EE4rZN.L/luTrkgqfpG";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Sorun metni Türkçe (fmt) döner; API'de badLoose ile isteğin diline çevrilir. */
export function passwordProblem(pw: string, username?: string): string | null {
  if (pw.length < PASSWORD_MIN) return fmt("Şifre en az {n} karakter olmalı.", { n: PASSWORD_MIN });
  if (pw.length > PASSWORD_MAX) return fmt("Şifre en fazla {n} karakter olabilir.", { n: PASSWORD_MAX });
  if (username && pw.toLowerCase().includes(username.toLowerCase())) return fmt("Şifre kullanıcı adını içeremez.");
  if (/^(.)\1+$/.test(pw)) return fmt("Şifre tek bir karakterin tekrarı olamaz.");
  return null;
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw: string, hash: string | null) {
  const ok = await bcrypt.compare(pw, hash ?? DUMMY);
  return hash ? ok : false;
}
