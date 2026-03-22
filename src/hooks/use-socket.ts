"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function useSocket(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch("/api/socket/token");
        if (!res.ok) {
          console.error("[socket] Token fetch failed:", res.status);
          return;
        }
        const { token } = await res.json();

        if (cancelled) return;

        const sock = io(SOCKET_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
        });

        sock.on("connect", () => {
          setConnected(true);
          sock.emit("session:join", { sessionId });
        });

        sock.on("disconnect", () => {
          setConnected(false);
        });

        sock.on("connect_error", (err) => {
          console.error("[socket] Connection error:", err.message);
        });

        socketRef.current = sock;
        setSocket(sock);
      } catch (err) {
        console.error("[socket] Connect error:", err);
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("session:leave");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [sessionId]);

  return { socket, connected };
}
