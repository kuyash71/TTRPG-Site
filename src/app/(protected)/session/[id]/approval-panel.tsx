"use client";

import { useState, useEffect } from "react";

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
  };
  gmComment: string | null;
  submittedAt: string;
  player: { id: string; username: string };
}

interface Props {
  sessionId: string;
}

export function ApprovalPanel({ sessionId }: Props) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/approval-requests`)
      .then((res) => res.json())
      .then((data) => {
        setRequests(data);
        setLoading(false);
      });
  }, [sessionId]);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  async function handleApprove(reqId: string) {
    const res = await fetch(
      `/api/sessions/${sessionId}/approval-requests/${reqId}/approve`,
      { method: "POST" }
    );
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: "APPROVED" } : r))
      );
    }
  }

  async function handleReject(reqId: string) {
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
    }
  }

  if (loading) return null;
  if (pendingRequests.length === 0) return null;

  return (
    <div className="rounded-lg border border-gold-900/50 bg-surface p-4">
      <h3 className="heading-gothic mb-3 flex items-center gap-2 text-sm font-semibold text-gold-400">
        Karakter Onayları
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
