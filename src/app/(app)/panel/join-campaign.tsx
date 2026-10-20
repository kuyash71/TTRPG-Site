"use client";
import { useGo } from "@/components/app-link";
import { useState } from "react";
import { useAction, useToast } from "@/components/interactive";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/client";
import { campaignHref, type Sys } from "@/lib/links";

export function JoinCampaign() {
  const go = useGo();
  const { busy, run } = useAction();
  const toast = useToast();
  const [code, setCode] = useState("");
  return (
    <Card className="p-5">
      <p className="kicker mb-2">Kampanyaya katıl</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => api<{ id: string; role: "PLAYER" | "SPECTATOR"; system: Sys }>("/api/campaigns/join", { body: { code } }));
          if (r) {
            toast(r.role === "SPECTATOR" ? "Kampanyaya izleyici olarak katıldın." : "Kampanyaya katıldın.", "ok");
            go(campaignHref(r.system, r.id));
          }
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-EFGH" maxLength={12} className="input font-mono uppercase" />
        <Button type="submit" variant="primary" disabled={busy || code.length < 4}>
          Katıl
        </Button>
      </form>
    </Card>
  );
}
