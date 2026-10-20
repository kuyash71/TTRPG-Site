import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "shz_sid";
const LEGACY_COOKIE = "shz_session";
const SESSION_TTL_S = 60 * 60 * 24 * 14;
const PUBLIC = [/^\/giris(\/|$)/, /^\/sifremi-unuttum(\/|$)/, /^\/kayit(\/|$)/, /^\/kurallar(\/|$)/, /^\/umbracaelis(\/|$)/, /^\/yardim(\/|$)/, /^\/icon/, /^\/api\//, /^\/emblems\//, /^\/favicon/];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname; // basePath hariç
  // Eski çerez (yalnızca /schwarzesonne yolunda geçerli) yeni ortak çereze taşınır: SHZ ve UC aynı oturumu kullanır.
  const legacy = req.cookies.get(LEGACY_COOKIE)?.value;
  const migrate = !req.cookies.get(SESSION_COOKIE)?.value && !!legacy && /^[A-Za-z0-9_-]{20,100}$/.test(legacy);
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value || migrate;

  // Kaba erişim kontrolü (asıl doğrulama sunucu tarafında yapılır).
  if (!PUBLIC.some((r) => r.test(path)) && !hasSession) {
    // Uygulama nginx arkasında 127.0.0.1'de çalıştığı için req.nextUrl iç adresi (https://localhost:3000/...)
    // içerir ve kullanıcıyı yanlış yere atar. Adresi tarayıcının istediği Host ve şemadan kuruyoruz.
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const target = new URL(`${req.nextUrl.basePath}/giris`, `${proto}://${host}`);
    if (path !== "/") target.searchParams.set("sonra", path);
    const res = NextResponse.redirect(target);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // İçerik Güvenliği Politikası: her istek için yeni nonce.
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const host = req.headers.get("host") ?? "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' wss://${host}${dev ? ` ws://${host}` : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  if (migrate) requestHeaders.set("cookie", `${req.headers.get("cookie") ?? ""}; ${SESSION_COOKIE}=${legacy}`);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  if (migrate) {
    const secure = dev ? "" : "; Secure";
    res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${legacy}; Path=/; Max-Age=${SESSION_TTL_S}; HttpOnly; SameSite=Lax${secure}`);
    res.headers.append("Set-Cookie", `${LEGACY_COOKIE}=; Path=${req.nextUrl.basePath || "/schwarzesonne"}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
