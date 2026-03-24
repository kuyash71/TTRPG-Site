"use client";

import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { Icon } from "@/components/icon";

interface ApprovalRequest {
  id: string;
  status: string;
  snapshot: {
    name: string;
    raceId: string;
    classId: string;
    backstory: string;
    spentPoints: number;
    maxPoints: number;
    previewStats: { key: string; label: string; type: string; currentValue: number; maxValue: number | null }[];
    skillAllocations: Record<string, number>;
    customFields?: { id: string; title: string; content: string; isPrivate: boolean }[];
  };
  gmComment: string | null;
  submittedAt: string;
  player: { id: string; username: string };
}

interface Props {
  sessionId: string;
  socket: Socket | null;
}

export function ApprovalPanel({ sessionId, socket }: Props) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(() => {
    fetch(`/api/sessions/${sessionId}/approval-requests`)
      .then((res) => res.json())
      .then((data) => {
        setRequests(data);
        setLoading(false);
      });
  }, [sessionId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Socket: yeni onay isteği geldiğinde listeyi yenile
  useEffect(() => {
    if (!socket) return;

    socket.on("gm:approval_request", fetchRequests);

    return () => {
      socket.off("gm:approval_request", fetchRequests);
    };
  }, [socket, fetchRequests]);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  async function handleApprove(reqId: string) {
    const req = requests.find((r) => r.id === reqId);
    const res = await fetch(
      `/api/sessions/${sessionId}/approval-requests/${reqId}/approve`,
      { method: "POST" }
    );
    if (res.ok) {
      const data = await res.json();
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: "APPROVED" } : r))
      );
      socket?.emit("gm:approve_character", {
        sessionId,
        playerId: req?.player.id,
        characterId: data.id,
      });
    }
  }

  async function handleReject(reqId: string) {
    const req = requests.find((r) => r.id === reqId);
    const comment = prompt("Red sebebi (opsiyonel):");
    const res = await fetch(
      `/api/sessions/${sessionId}/approval-requests/${reqId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmComment: comment }),
      }
    );
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === reqId ? { ...r, status: "REJECTED", gmComment: comment } : r
        )
      );
      socket?.emit("gm:reject_character", {
        sessionId,
        playerId: req?.player.id,
        reason: comment,
      });
    }
  }

  if (loading) return null;
  if (pendingRequests.length === 0) return null;

  return (
    <div className="rounded-lg border border-gold-900/50 bg-surface p-4">
      <h3 className="heading-gothic mb-3 flex items-center gap-2 text-sm font-semibold text-gold-400">
        <Icon name="scroll" size={16} /> Karakter Onayları
        <span className="rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-void">
          {pendingRequests.length}
        </span>
      </h3>

      <div className="space-y-3">
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            className="rounded-md border border-border bg-void p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-100">
                  {req.snapshot.name}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  by {req.player.username}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">
                {new Date(req.submittedAt).toLocaleDateString("tr-TR")}
              </span>
            </div>

            {/* Stat önizleme */}
            <div className="mb-2 flex flex-wrap gap-1">
              {req.snapshot.previewStats?.slice(0, 8).map((s) => (
                <span key={s.key} className="text-[10px] text-zinc-400">
                  {s.label || s.key}: {s.currentValue}
                </span>
              ))}
            </div>

            <div className="mb-2 text-[10px] text-zinc-500">
              SP: {req.snapshot.spentPoints}/{req.snapshot.maxPoints}
            </div>

            {req.snapshot.backstory && (
              <p className="mb-2 text-xs text-zinc-500 line-clamp-2">
                {req.snapshot.backstory}
              </p>
            )}

            {req.snapshot.customFields && req.snapshot.customFields.length > 0 && (
              <div className="mb-2 space-y-1">
                {req.snapshot.customFields.map((f) => (
                  <div key={f.id} className="flex items-center gap-1 text-[10px]">
                    <span className="font-medium text-zinc-400">{f.title || "Başlıksız"}:</span>
                    <span className="text-zinc-500 line-clamp-1">{f.content}</span>
                    {f.isPrivate && (
                      <span className="rounded bg-red-900/30 px-1 py-0.5 text-[9px] text-red-400">
                        Gizli
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(req.id)}
                className="rounded bg-green-900/50 px-3 py-1 text-xs font-medium text-green-400 hover:bg-green-900"
              >
                Onayla
              </button>
              <button
                onClick={() => handleReject(req.id)}
                className="rounded bg-red-900/50 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-900"
              >
                Reddet
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
