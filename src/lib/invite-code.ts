import { randomBytes } from "crypto";

export function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}
