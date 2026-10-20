import { route } from "@/lib/api";
import { endSession } from "@/lib/auth/session";

export const POST = route({ auth: "none", allowMustChange: true }, async () => {
  await endSession();
  return { ok: true };
});
