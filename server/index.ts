import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
// Simple dice roller — no external library
function parseDiceNotation(notation: string): { count: number; sides: number; modifier: number } | null {
  // Supports: 1d20, 2d6+3, 1d8-1, d20, 4d10+5, 1d100
  const match = notation.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, modifier };
}

function rollDice(parsed: { count: number; sides: number; modifier: number }): { rolls: number[]; total: number; output: string; notation: string } {
  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    rolls.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + parsed.modifier;
  const modStr = parsed.modifier > 0 ? `+${parsed.modifier}` : parsed.modifier < 0 ? `${parsed.modifier}` : "";
  const notation = `${parsed.count}d${parsed.sides}${modStr}`;
  const output = `[${rolls.join(", ")}]${modStr ? ` ${modStr}` : ""}`;
  return { rolls, total, output, notation };
}

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
  socket.on("dice:roll", async ({ notation, title }: { notation: string; title?: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId || !notation.trim()) return;

    const parsed = parseDiceNotation(notation.trim());
    if (!parsed) {
      socket.emit("dice:error", {
        message: "Geçersiz zar notasyonu. Örnek: 2d6+3, 1d20, 4d8",
      });
      return;
    }

    const roll = rollDice(parsed);

    try {
      const diceRoll = await prisma.diceRoll.create({
        data: {
          sessionId,
          userId: socket.data.userId,
          notation: roll.notation,
          results: roll.rolls,
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
        title: title || undefined,
        createdAt: diceRoll.createdAt.toISOString(),
      });

      // Also broadcast as OOC chat so dice results appear in chat
      const chatContent = title
        ? `🎲 ${title}: ${roll.notation} → ${roll.output} = ${roll.total}`
        : `🎲 ${roll.notation} → ${roll.output} = ${roll.total}`;

      const chatMsg = await prisma.chatMessage.create({
        data: {
          sessionId,
          userId: socket.data.userId,
          channel: "OOC",
          content: chatContent,
        },
      });

      io.to(`session:${sessionId}`).emit("chat:message", {
        id: chatMsg.id,
        userId: socket.data.userId,
        username: socket.data.username,
        channel: "OOC",
        content: chatMsg.content,
        createdAt: chatMsg.createdAt.toISOString(),
      });
    } catch (err) {
      console.error("[dice] DB error:", err);
      socket.emit("dice:error", {
        message: "Zar atılırken bir hata oluştu.",
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

  // ─── Loot Pool ──────────────────────────────────────
  socket.on(
    "loot:add",
    async ({ itemDefinitionId, quantity = 1 }: { itemDefinitionId: string; quantity?: number }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;

      try {
        const lootItem = await prisma.sessionLootItem.create({
          data: { sessionId, itemDefinitionId, quantity },
          include: {
            itemDefinition: {
              select: { id: true, name: true, description: true, category: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, rarity: true, iconUrl: true },
            },
          },
        });
        io.to(`session:${sessionId}`).emit("loot:pool_updated", { action: "add", lootItem });
      } catch (err) {
        console.error("[loot:add]", err);
      }
    }
  );

  socket.on("loot:remove", async ({ lootId }: { lootId: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    try {
      await prisma.sessionLootItem.delete({ where: { id: lootId } });
      io.to(`session:${sessionId}`).emit("loot:pool_updated", { action: "remove", lootId });
    } catch (err) {
      console.error("[loot:remove]", err);
    }
  });

  socket.on(
    "loot:take",
    async ({ lootId, characterId }: { lootId: string; characterId: string }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;

      try {
        const lootItem = await prisma.sessionLootItem.findUnique({
          where: { id: lootId },
          include: { itemDefinition: true },
        });
        if (!lootItem) return;

        // Grid boyutunu al
        const gameSession = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { gameset: { select: { config: true } } },
        });
        const config = (gameSession?.gameset?.config ?? {}) as Record<string, unknown>;
        const gridW = typeof config.inventoryGridWidth === "number" ? config.inventoryGridWidth : 10;
        const gridH = typeof config.inventoryGridHeight === "number" ? config.inventoryGridHeight : 6;

        // Boş yer bul
        const existing = await prisma.characterInventoryItem.findMany({
          where: { characterId, isEquipped: false },
        });

        const iDef = lootItem.itemDefinition;
        let posX = 0, posY = 0, placed = false;
        outer: for (let y = 0; y <= gridH - iDef.gridHeight; y++) {
          for (let x = 0; x <= gridW - iDef.gridWidth; x++) {
            const collision = existing.some(
              (e) =>
                x < e.posX + iDef.gridWidth &&
                x + iDef.gridWidth > e.posX &&
                y < e.posY + iDef.gridHeight &&
                y + iDef.gridHeight > e.posY
            );
            if (!collision) { posX = x; posY = y; placed = true; break outer; }
          }
        }

        // Loot al, envantere ekle
        const newItem = await prisma.characterInventoryItem.create({
          data: {
            characterId,
            itemDefinitionId: lootItem.itemDefinitionId,
            posX: placed ? posX : 0,
            posY: placed ? posY : 0,
            quantity: lootItem.quantity,
          },
        });

        // Miktar 1'den fazlaysa sadece 1 düş; eğer bittiyse sil
        if (lootItem.quantity <= 1) {
          await prisma.sessionLootItem.delete({ where: { id: lootId } });
          io.to(`session:${sessionId}`).emit("loot:pool_updated", { action: "remove", lootId });
        } else {
          const updated = await prisma.sessionLootItem.update({
            where: { id: lootId },
            data: { quantity: { decrement: 1 } },
            include: { itemDefinition: { select: { id: true, name: true, description: true, category: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, rarity: true, iconUrl: true } } },
          });
          io.to(`session:${sessionId}`).emit("loot:pool_updated", { action: "update", lootItem: updated });
        }

        io.to(`session:${sessionId}`).emit("inv:item_added", { characterId, item: newItem });
      } catch (err) {
        console.error("[loot:take]", err);
      }
    }
  );

  // ─── Wallet ──────────────────────────────────────────
  socket.on("wallet:update", async ({ characterId, balances }: { characterId: string; balances: Record<string, number> }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    try {
      io.to(`session:${sessionId}`).emit("wallet:updated", { characterId, balances });
    } catch (err) {
      console.error("[wallet:update]", err);
    }
  });

  // ─── Money Transfer ──────────────────────────────────
  socket.on("money:send_request", async ({ fromCharId, toCharId, amounts }: { fromCharId: string; toCharId: string; amounts: Record<string, number> }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    try {
      const transfer = await prisma.moneyTransfer.create({
        data: { sessionId, fromCharId, toCharId, amounts, status: "PENDING" },
        include: {
          fromChar: { select: { id: true, name: true, user: { select: { username: true } } } },
          toChar: { select: { id: true, name: true, user: { select: { username: true, id: true } } } },
        },
      });
      io.to(`session:${sessionId}`).emit("money:transfer_request", {
        id: transfer.id,
        fromChar: transfer.fromChar,
        toChar: transfer.toChar,
        amounts: transfer.amounts,
        status: "PENDING",
      });
    } catch (err) {
      console.error("[money:send_request]", err);
    }
  });

  socket.on("money:accept_transfer", async ({ transferId }: { transferId: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    try {
      const transfer = await prisma.moneyTransfer.findUnique({
        where: { id: transferId },
        include: {
          fromChar: { include: { wallet: true } },
          toChar: { include: { wallet: true } },
        },
      });
      if (!transfer || transfer.status !== "PENDING") return;

      const amounts = transfer.amounts as Record<string, number>;
      const fromBalances = (transfer.fromChar.wallet?.balances as Record<string, number>) ?? {};
      const toBalances = (transfer.toChar.wallet?.balances as Record<string, number>) ?? {};

      // Check sufficient funds
      for (const [code, amount] of Object.entries(amounts)) {
        if ((fromBalances[code] ?? 0) < amount) {
          socket.emit("money:transfer_error", { transferId, message: "Yetersiz bakiye" });
          return;
        }
      }

      // Deduct from sender, add to receiver
      const newFromBalances = { ...fromBalances };
      const newToBalances = { ...toBalances };
      for (const [code, amount] of Object.entries(amounts)) {
        newFromBalances[code] = (newFromBalances[code] ?? 0) - amount;
        newToBalances[code] = (newToBalances[code] ?? 0) + amount;
      }

      await prisma.$transaction([
        prisma.characterWallet.update({ where: { characterId: transfer.fromCharId }, data: { balances: newFromBalances } }),
        prisma.characterWallet.update({ where: { characterId: transfer.toCharId }, data: { balances: newToBalances } }),
        prisma.moneyTransfer.update({ where: { id: transferId }, data: { status: "ACCEPTED" } }),
      ]);

      io.to(`session:${sessionId}`).emit("money:transfer_result", {
        transferId,
        status: "ACCEPTED",
        fromCharId: transfer.fromCharId,
        toCharId: transfer.toCharId,
        fromBalances: newFromBalances,
        toBalances: newToBalances,
      });
    } catch (err) {
      console.error("[money:accept_transfer]", err);
    }
  });

  socket.on("money:reject_transfer", async ({ transferId }: { transferId: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    try {
      const transfer = await prisma.moneyTransfer.update({
        where: { id: transferId },
        data: { status: "REJECTED" },
        select: { fromCharId: true, toCharId: true },
      });
      io.to(`session:${sessionId}`).emit("money:transfer_result", {
        transferId,
        status: "REJECTED",
        fromCharId: transfer.fromCharId,
        toCharId: transfer.toCharId,
      });
    } catch (err) {
      console.error("[money:reject_transfer]", err);
    }
  });

  // ─── Store ───────────────────────────────────────────
  socket.on("store:activate", async ({ storeId }: { storeId: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    try {
      // Diğer aktif mağazaları kapat
      await prisma.store.updateMany({ where: { sessionId, isActive: true }, data: { isActive: false } });

      const store = await prisma.store.update({
        where: { id: storeId },
        data: { isActive: true },
        include: {
          items: {
            include: {
              itemDefinition: { select: { id: true, name: true, description: true, category: true, gridWidth: true, gridHeight: true, equipmentSlot: true, statBonuses: true, rarity: true, iconUrl: true } },
            },
          },
        },
      });

      io.to(`session:${sessionId}`).emit("store:activated", { store });
    } catch (err) {
      console.error("[store:activate]", err);
    }
  });

  socket.on("store:deactivate", async ({ storeId }: { storeId: string }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    try {
      await prisma.store.update({ where: { id: storeId }, data: { isActive: false } });
      io.to(`session:${sessionId}`).emit("store:deactivated", { storeId });
    } catch (err) {
      console.error("[store:deactivate]", err);
    }
  });

  socket.on(
    "store:offer",
    async ({ storeId, storeItemId, characterId, offeredPrice }: { storeId: string; storeItemId: string; characterId: string; offeredPrice: number }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;

      try {
        const tx = await prisma.pendingTransaction.create({
          data: { storeId, storeItemId, characterId, offeredPrice, status: "PENDING" },
          include: {
            storeItem: { include: { itemDefinition: { select: { id: true, name: true, category: true, rarity: true, gridWidth: true, gridHeight: true } } } },
            character: { select: { id: true, name: true, user: { select: { username: true } } } },
          },
        });

        // Sadece GM'e bildir
        io.to(`session:${sessionId}`).emit("store:new_offer", { transaction: tx });
      } catch (err) {
        console.error("[store:offer]", err);
      }
    }
  );

  socket.on(
    "store:approve_offer",
    async ({ txId, sessionId: sid }: { txId: string; sessionId: string }) => {
      if (!sid) return;

      try {
        const tx = await prisma.pendingTransaction.findUnique({
          where: { id: txId },
          include: {
            storeItem: { include: { itemDefinition: true } },
            character: { include: { wallet: true, inventoryItems: true } },
          },
        });
        if (!tx || tx.status !== "PENDING") return;

        const wallet = tx.character.wallet;
        const balances = (wallet?.balances as Record<string, number>) ?? {};
        const primaryCurrency = Object.keys(balances)[0] ?? "gold";
        const currentAmount = balances[primaryCurrency] ?? 0;
        if (!wallet || currentAmount < tx.offeredPrice) {
          socket.emit("store:offer_result", { txId, status: "ERROR", message: "Yetersiz bakiye" });
          return;
        }

        const iDef = tx.storeItem.itemDefinition;
        const config = { gridW: 10, gridH: 6 };

        const existing = tx.character.inventoryItems.filter((i) => !i.isEquipped);
        let posX = 0, posY = 0, placed = false;
        outer: for (let y = 0; y <= config.gridH - iDef.gridHeight; y++) {
          for (let x = 0; x <= config.gridW - iDef.gridWidth; x++) {
            const collision = existing.some(
              (e) =>
                x < e.posX + iDef.gridWidth &&
                x + iDef.gridWidth > e.posX &&
                y < e.posY + iDef.gridHeight &&
                y + iDef.gridHeight > e.posY
            );
            if (!collision) { posX = x; posY = y; placed = true; break outer; }
          }
        }

        const newBalances = { ...balances, [primaryCurrency]: currentAmount - tx.offeredPrice };
        const [, newItem] = await prisma.$transaction([
          prisma.characterWallet.update({
            where: { characterId: tx.characterId },
            data: { balances: newBalances },
          }),
          prisma.characterInventoryItem.create({
            data: { characterId: tx.characterId, itemDefinitionId: iDef.id, posX: placed ? posX : 0, posY: placed ? posY : 0, quantity: 1 },
          }),
          prisma.pendingTransaction.update({ where: { id: txId }, data: { status: "APPROVED" } }),
        ]);

        io.to(`session:${sid}`).emit("store:offer_result", { txId, status: "APPROVED", characterId: tx.characterId, newItem });
      } catch (err) {
        console.error("[store:approve_offer]", err);
      }
    }
  );

  socket.on(
    "store:reject_offer",
    async ({ txId, sessionId: sid }: { txId: string; sessionId: string }) => {
      if (!sid) return;

      try {
        const tx = await prisma.pendingTransaction.update({
          where: { id: txId },
          data: { status: "REJECTED" },
          select: { characterId: true },
        });
        io.to(`session:${sid}`).emit("store:offer_result", { txId, status: "REJECTED", characterId: tx.characterId });
      } catch (err) {
        console.error("[store:reject_offer]", err);
      }
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
