import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const PORT = parseInt(process.env.PORT || "3001", 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
];
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

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
    };
    socket.data.userId = decoded.id;
    socket.data.role = decoded.role;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.data.userId} (${socket.data.role})`);

  // ─── Session join/leave (Sprint 3) ─────────────────
  socket.on("session:join", ({ sessionId }: { sessionId: string }) => {
    socket.join(`session:${sessionId}`);
    socket.to(`session:${sessionId}`).emit("session:player_joined", {
      userId: socket.data.userId,
    });
  });

  socket.on("session:leave", () => {
    // Will be implemented in Sprint 3
  });

  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.data.userId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
