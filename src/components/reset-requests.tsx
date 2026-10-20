"use client";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton, Modal, useAction } from "@/components/interactive";
import { Badge, Button, Card } from "@/components/ui";
import { api } from "@/lib/client";

export interface ResetItem {
  id: string;
  username: string;
  displayName: string;
  status: "PENDING" | "APPROVED";
  createdAt: string;
  codeExpiresAt: string | null;
  campaigns: string[];
}

/**
 * GM / site yöneticisi için açık şifre sıfırlama istekleri. Onaylayınca tek kullanımlık kod bir kez gösterilir;
 * GM kodu oyuncuya iletir, oyuncu o kodla girip yeni şifresini belirler.
 */
export function ResetRequests({ items }: { items: ResetItem[] }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [code, setCode] = useState<{ name: string; username: string; code: string } | null>(null);
  if (!items.length) return null;
  const act = async (it: ResetItem, action: "approve" | "deny") => {
    const r = await run(() => api<{ code?: string }>(`/api/password-resets/${it.id}`, { body: { action } }), action === "deny" ? "İstek reddedildi." : undefined);
    if (r && r.code) setCode({ name: it.displayName, username: it.username, code: r.code });
    if (r) router.refresh();
  };
  return (
    <section id="sifre-istekleri" className="scroll-mt-24">
    <Card className="border-warn/50 p-5">
      <p className="kicker mb-3 flex items-center gap-2 text-warn">
        <KeyRound className="h-4 w-4" /> Şifre sıfırlama istekleri
      </p>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="rounded-lg border border-line bg-surface2/40 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="text-ink">{it.displayName}</strong> <span className="text-xs text-muted">@{it.username}</span>
              </span>
              {it.status === "APPROVED" ? <Badge tone="accent">Kod verildi</Badge> : <Badge tone="warn">Onay bekliyor</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {new Date(it.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
              {it.campaigns.length > 0 && ` · ${it.campaigns.join(", ")}`}
              {it.status === "APPROVED" && it.codeExpiresAt && ` · kod ${new Date(it.codeExpiresAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} tarihine kadar geçerli`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={busy} onClick={() => act(it, "approve")}>
                {it.status === "APPROVED" ? "Yeni kod üret" : "Onayla, kod üret"}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(it, "deny")}>
                Reddet
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">Kodu oyuncuya güvenli bir yoldan ilet. Oyuncu girişte &quot;Sıfırlama kodum var&quot;ı seçip kodu yazar ve hemen yeni şifresini belirler.</p>
      <Modal open={!!code} onClose={() => setCode(null)} title="Tek kullanımlık sıfırlama kodu">
        {code && (
          <div className="space-y-4 text-sm">
            <p>
              <strong>{code.name}</strong> (@{code.username}) için kod. Bu kod yalnızca şimdi gösterilir ve 24 saat geçerlidir.
            </p>
            <p className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-3 text-center font-mono text-xl tracking-widest text-ink" data-testid="reset-code">
              {code.code}
            </p>
            <div className="flex justify-end gap-2">
              <CopyButton text={code.code} />
              <Button onClick={() => setCode(null)}>Kapat</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
    </section>
  );
}
