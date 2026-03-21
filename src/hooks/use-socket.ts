"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export function useSocket(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function connect() {
      // Fetch socket token from our API
      const res = await fetch("/api/socket/token");
      if (!res.ok) return;
      const { token } = await res.json();

      if (cancelled) return;

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        setConnected(true);
        socket.emit("session:join", { sessionId });
      });

      socket.on("disconnect", () => {
        setConnected(false);
      });

      socketRef.current = socket;
    }

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.emit("session:leave");
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [sessionId]);

  return { socket: socketRef.current, connected };
}
