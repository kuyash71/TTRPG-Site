import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";

// ─── Config ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3001", 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
];
const JWT_SECRET = process.env.SOCKET_JWT_SECRET || "dev-secret";

// ─── Prisma ──────────────────────────────────────────────
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ─── Socket.io ───────────────────────────────────────────
const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// JWT authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication required"));

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      username: string;
    };
    socket.data.userId = decoded.id;
    socket.data.role = decoded.role;
    socket.data.username = decoded.username;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.data.username} (${socket.data.role})`);

  // ─── Session join ────────────────────────────────────
  socket.on("session:join", async ({ sessionId }: { sessionId: string }) => {
    socket.join(`session:${sessionId}`);
    socket.data.sessionId = sessionId;

    socket.to(`session:${sessionId}`).emit("session:player_joined", {
      userId: socket.data.userId,
      username: socket.data.username,
    });

    console.log(`[join] ${socket.data.username} → session:${sessionId}`);
  });

  // ─── Session leave ───────────────────────────────────
  socket.on("session:leave", () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    socket.leave(`session:${sessionId}`);
    socket.to(`session:${sessionId}`).emit("session:player_left", {
      userId: socket.data.userId,
      username: socket.data.username,
    });
    socket.data.sessionId = null;

    console.log(`[leave] ${socket.data.username} ← session:${sessionId}`);
  });

  // ─── Chat message ───────────────────────────────────
  socket.on(
    "chat:send",
    async ({
      content,
      channel,
    }: {
      content: string;
      channel: "IC" | "OOC";
    }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId || !content.trim()) return;

      const message = await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: socket.data.userId,
          channel,
          content: content.trim(),
        },
      });

      io.to(`session:${sessionId}`).emit("chat:message", {
        id: message.id,
        userId: socket.data.userId,
        username: socket.data.username,
        channel,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      });
    }
  );

  // ─── Dice roll ──────────────────────────────────────
  socket.on("dice:roll", async ({ notation }: { notation: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId || !notation.trim()) return;

    try {
      const roll = new DiceRoll(notation.trim());

      const diceRoll = await prisma.diceRoll.create({
        data: {
          sessionId,
          userId: socket.data.userId,
          notation: roll.notation,
          results: JSON.parse(JSON.stringify(roll.rolls)),
          total: roll.total,
        },
      });

      io.to(`session:${sessionId}`).emit("dice:result", {
        id: diceRoll.id,
        userId: socket.data.userId,
        username: socket.data.username,
        notation: roll.notation,
        output: roll.output,
        total: roll.total,
        createdAt: diceRoll.createdAt.toISOString(),
      });
    } catch {
      socket.emit("dice:error", {
        message: "Geçersiz zar notasyonu. Örnek: 2d6+3, 1d20, 4d8",
      });
    }
  });

  // ─── Disconnect ─────────────────────────────────────
  socket.on("disconnect", () => {
    const sessionId = socket.data.sessionId;
    if (sessionId) {
      socket.to(`session:${sessionId}`).emit("session:player_left", {
        userId: socket.data.userId,
        username: socket.data.username,
      });
    }
    console.log(`[disconnect] ${socket.data.username}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
