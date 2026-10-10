/**
 * Uygulama sunucusu: Next.js + Socket.io tek süreçte, yalnızca 127.0.0.1'i dinler.
 * Dışarıya nginx üzerinden açılır (deploy/nginx-umbracaelis.conf).
 */
import fs from "node:fs";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const envFile = process.env.SHZ_ENV_FILE || ".env";
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";

const { attachRealtime } = await import("./server/realtime");

const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler();
await app.prepare();

// umbracaelis.com/umbracaelis/... (Umbra Caelis kuralları) uygulamanın içinde /schwarzesonne/umbracaelis/... olarak çizilir.
const UC_PATH = /^\/umbracaelis(?:[/?#]|$)/;

server.on("request", (req, res) => {
  if (req.url && UC_PATH.test(req.url)) {
    // Bölümün kökü kural kitabına açılır.
    if (/^\/umbracaelis\/?(?:[?#]|$)/.test(req.url)) {
      res.writeHead(308, { Location: "/umbracaelis/kurallar", "Cache-Control": "no-store" });
      res.end();
      return;
    }
    req.url = "/schwarzesonne" + req.url;
  }
  handle(req, res).catch((e) => {
    console.error("[http]", e);
    res.statusCode = 500;
    res.end("Sunucu hatası");
  });
});

const io = new Server(server, {
  path: "/schwarzesonne/socket.io",
  serveClient: false,
  maxHttpBufferSize: 16_000,
  destroyUpgrade: false,
  cors: { origin: false },
  pingInterval: 20_000,
  pingTimeout: 20_000,
});
attachRealtime(io);

server.listen(port, hostname, () => {
  console.log(`Schwarzesonne hazır: http://${hostname}:${port}/schwarzesonne (${dev ? "geliştirme" : "üretim"})`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
