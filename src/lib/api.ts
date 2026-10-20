import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hit } from "./auth/ratelimit";
import { clientIp, currentUser, type SessionUser } from "./auth/session";
import { appOrigin, isProd } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const bad = (m: string) => new ApiError(400, m);
export const forbidden = (m = "Bu işlem için yetkin yok.") => new ApiError(403, m);
export const notFound = (m = "Bulunamadı.") => new ApiError(404, m);
export const conflict = (m: string) => new ApiError(409, m);

const MAX_BODY = 64 * 1024;

type Auth = "none" | "user" | "gm" | "admin";
type Params = Record<string, string>;
type Ctx<B, A extends Auth> = {
  req: NextRequest;
  params: Params;
  body: B;
  user: A extends "none" ? SessionUser | null : SessionUser;
  ip: string;
};

/**
 * Tüm API uçlarının ortak sarmalayıcısı:
 *  - değiştiren isteklerde Origin kontrolü (CSRF), JSON ve boyut sınırı
 *  - zod ile gövde doğrulaması
 *  - oturum / GM yetkisi kontrolü
 *  - kullanıcı başına genel hız sınırı
 *  - hata mesajlarının sızmasını önleyen tek tip hata cevabı
 */
export function route<S extends z.ZodType = z.ZodType<undefined>, A extends Auth = "user">(
  opts: { auth?: A; body?: S; limit?: number; maxBody?: number; allowMustChange?: boolean },
  handler: (ctx: Ctx<z.infer<S>, A>) => Promise<unknown>,
) {
  return async (req: NextRequest, segment: { params: Promise<Params> }) => {
    try {
      const ip = clientIp(req.headers);
      const mutating = req.method !== "GET" && req.method !== "HEAD";
      if (mutating) {
        const origin = req.headers.get("origin");
        if (!origin || (origin !== appOrigin() && !(origin.startsWith("http://localhost") && !isProd)))
          throw forbidden("Geçersiz istek kaynağı.");
      }
      const auth = (opts.auth ?? "user") as Auth;
      const user = await currentUser();
      if (auth !== "none" && !user) throw new ApiError(401, "Giriş yapman gerekiyor.");
      if (auth !== "none" && user?.mustChangePassword && !opts.allowMustChange) throw forbidden("Önce yeni şifreni belirlemelisin.");
      if (auth === "gm" && user?.role !== "GM") throw forbidden();
      if (auth === "admin" && !user?.isAdmin) throw forbidden("Bu işlem yalnızca site yöneticisine açık.");
      const limitKey = `${user?.id ?? ip}:${mutating ? "w" : "r"}`;
      if (!hit(limitKey, opts.limit ?? (mutating ? 120 : 600), 60_000)) throw new ApiError(429, "Çok fazla istek. Biraz bekle.");

      let body: unknown = undefined;
      if (opts.body) {
        if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw bad("JSON bekleniyor.");
        const raw = await req.text();
        if (raw.length > (opts.maxBody ?? MAX_BODY)) throw new ApiError(413, "İstek çok büyük.");
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          throw bad("Geçersiz JSON.");
        }
        const r = opts.body.safeParse(parsed);
        if (!r.success) {
          const first = r.error.issues[0];
          throw bad(first ? `${first.path.join(".") || "gövde"}: ${first.message}` : "Geçersiz veri.");
        }
        body = r.data;
      }
      const params = (await segment?.params) ?? {};
      const out = await handler({ req, params, body: body as z.infer<S>, user: user as Ctx<z.infer<S>, A>["user"], ip });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
    }
  };
}

export const zId = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
export const zText = (max: number) => z.string().trim().max(max);
