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

  // ─── Character update (broadcast to room) ─────────
  socket.on(
    "character:update",
    async ({ characterId, stats }: { characterId: string; stats: { name: string; currentValue: number }[] }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId || !characterId) return;

      // Broadcast public stat changes to everyone in the room
      io.to(`session:${sessionId}`).emit("character:updated", {
        characterId,
        userId: socket.data.userId,
        username: socket.data.username,
        stats,
      });
    }
  );

  socket.on(
    "character:update_private",
    async ({ characterId, data }: { characterId: string; data: Record<string, unknown> }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId || !characterId) return;

      // Private updates only go to the owner and GM (not broadcast to all)
      socket.emit("character:private_updated", {
        characterId,
        data,
      });
    }
  );

  // ─── Character approval flow ────────────────────────
  socket.on(
    "char:submit_for_approval",
    ({ sessionId: sid }: { sessionId: string }) => {
      if (!sid) return;
      // GM'e bildir
      socket.to(`session:${sid}`).emit("gm:approval_request", {
        playerId: socket.data.userId,
        username: socket.data.username,
      });
    }
  );

  socket.on(
    "gm:approve_character",
    ({ sessionId: sid, playerId, characterId }: { sessionId: string; playerId: string; characterId: string }) => {
      if (!sid) return;
      io.to(`session:${sid}`).emit("session:character_approved", {
        playerId,
        characterId,
      });
    }
  );

  socket.on(
    "gm:reject_character",
    ({ sessionId: sid, playerId, reason }: { sessionId: string; playerId: string; reason?: string }) => {
      if (!sid) return;
      io.to(`session:${sid}`).emit("char:approval_rejected", {
        playerId,
        reason,
      });
    }
  );

  socket.on(
    "char:skill_unlock",
    ({ sessionId: sid, characterId, nodeId, newLevel }: { sessionId: string; characterId: string; nodeId: string; newLevel: number }) => {
      if (!sid) return;
      io.to(`session:${sid}`).emit("char:skill_unlocked", {
        characterId,
        userId: socket.data.userId,
        nodeId,
        newLevel,
      });
    }
  );

  socket.on(
    "char:level_up",
    ({ sessionId: sid, characterId, newLevel }: { sessionId: string; characterId: string; newLevel: number }) => {
      if (!sid) return;
      io.to(`session:${sid}`).emit("char:leveled_up", {
        characterId,
        newLevel,
      });
    }
  );

  // ─── Inventory events ───────────────────────────────
  socket.on(
    "inv:move",
    ({ characterId, inventoryItemId, posX, posY }: { characterId: string; inventoryItemId: string; posX: number; posY: number }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("inv:moved", {
        characterId,
        inventoryItemId,
        posX,
        posY,
      });
    }
  );

  socket.on(
    "inv:equip",
    ({ characterId, inventoryItemId, slot, stats }: { characterId: string; inventoryItemId: string; slot: string; stats: unknown[] }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("inv:equipped", {
        characterId,
        inventoryItemId,
        slot,
        stats,
      });
    }
  );

  socket.on(
    "inv:unequip",
    ({ characterId, inventoryItemId, stats }: { characterId: string; inventoryItemId: string; stats: unknown[] }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("inv:unequipped", {
        characterId,
        inventoryItemId,
        stats,
      });
    }
  );

  socket.on(
    "inv:drop",
    ({ characterId, inventoryItemId }: { characterId: string; inventoryItemId: string }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("inv:dropped", {
        characterId,
        inventoryItemId,
      });
    }
  );

  socket.on(
    "gm:item_add",
    ({ characterId, item }: { characterId: string; item: Record<string, unknown> }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("inv:item_added", {
        characterId,
        item,
      });
    }
  );

  // ─── Spell events ──────────────────────────────────
  socket.on(
    "char:use_spell",
    ({ characterId, spellId, spellName, manaCost, remainingMana }: { characterId: string; spellId: string; spellName: string; manaCost: number; remainingMana: number | null }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("char:spell_cast", {
        characterId,
        userId: socket.data.userId,
        username: socket.data.username,
        spellId,
        spellName,
        manaCost,
        remainingMana,
      });
    }
  );

  socket.on(
    "char:assign_spell_slot",
    ({ characterId, spellId, slotIndex }: { characterId: string; spellId: string; slotIndex: number | null }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      io.to(`session:${sessionId}`).emit("char:spell_slot_updated", {
        characterId,
        spellId,
        slotIndex,
      });
    }
  );

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
