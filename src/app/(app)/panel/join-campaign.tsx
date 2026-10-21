"use client";
import { useGo } from "@/components/app-link";
import { useState } from "react";
import { useAction, useToast } from "@/components/interactive";
import { Button, Card } from "@/components/ui";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client";
import { campaignHref, type Sys } from "@/lib/links";

export function JoinCampaign() {
  const go = useGo();
  const { busy, run } = useAction();
  const toast = useToast();
  const t = useT();
  const [code, setCode] = useState("");
  return (
    <Card className="p-5">
      <p className="kicker mb-2">{t("Kampanyaya katıl")}</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => api<{ id: string; role: "PLAYER" | "SPECTATOR"; system: Sys }>("/api/campaigns/join", { body: { code } }));
          if (r) {
            toast(r.role === "SPECTATOR" ? t("Kampanyaya izleyici olarak katıldın.") : t("Kampanyaya katıldın."), "ok");
            go(campaignHref(r.system, r.id));
          }
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-EFGH" maxLength={12} className="input font-mono uppercase" />
        <Button type="submit" variant="primary" disabled={busy || code.length < 4}>
          {t("Katıl")}
        </Button>
      </form>
    </Card>
  );
}
