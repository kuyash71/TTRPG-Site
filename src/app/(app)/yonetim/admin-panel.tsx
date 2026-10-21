"use client";
import { useCallback, useEffect, useState } from "react";
import { CopyButton, Tabs, useAction } from "@/components/interactive";
import { Badge, Button, Card, Field } from "@/components/ui";
import { withBase } from "@/lib/base";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { api } from "@/lib/client";

interface Invite {
  id: string;
  hint: string;
  note: string | null;
  role: "GM" | "PLAYER";
  memberRole: "PLAYER" | "SPECTATOR";
  campaignName: string | null;
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}
interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: "GM" | "PLAYER";
  isAdmin: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const fmtDate = (d: string | null, il: string) => (d ? new Date(d).toLocaleString(il, { dateStyle: "short", timeStyle: "short" }) : "—");

export function AdminPanel({ campaigns, selfId, isAdmin }: { campaigns: { id: string; name: string }[]; selfId: string; isAdmin: boolean }) {
  const t = useT();
  const [tab, setTab] = useState<"davet" | "kullanici">("davet");
  return (
    <div>
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[{ key: "davet", label: t("Davetler") }, ...(isAdmin ? [{ key: "kullanici" as const, label: t("Kullanıcılar") }] : [])]}
      />
      {tab === "davet" || !isAdmin ? <Invites campaigns={campaigns} isAdmin={isAdmin} /> : <Users selfId={selfId} />}
    </div>
  );
}

function Invites({ campaigns, isAdmin }: { campaigns: { id: string; name: string }[]; isAdmin: boolean }) {
  const { busy, run } = useAction();
  const t = useT();
  const il = intlLocale(useLocale());
  const [list, setList] = useState<Invite[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  const load = useCallback(() => api<{ invites: Invite[] }>("/api/invites").then((r) => setList(r.invites)), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  const link = created ? `${window.location.origin}${withBase(`/kayit?kod=${created}`)}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit p-5">
        <h2 className="mb-4 font-serif text-lg">{t("Yeni davet")}</h2>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await run(() =>
              api<{ code: string }>("/api/invites", {
                body: {
                  note: String(f.get("note") || "") || undefined,
                  role: f.get("role") === "GM" ? "GM" : "PLAYER",
                  memberRole: f.get("role") === "SPECTATOR" ? "SPECTATOR" : "PLAYER",
                  campaignId: f.get("campaignId") || null,
                  days: Number(f.get("days")),
                },
              }),
            );
            if (r) {
              setCreated(r.code);
              load();
            }
          }}
        >
          <Field label={t("Not")} hint={t("Kimin için olduğunu hatırlamak için (ör. oyuncunun adı)")}>
            <input name="note" maxLength={80} className="input" />
          </Field>
          <Field label={t("Kampanya")} hint={t("Seçersen oyuncu kayıt olunca otomatik katılır")}>
            <select name="campaignId" className="input">
              <option value="">{t("Yok")}</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Rol")}>
              <select name="role" className="input" defaultValue="PLAYER">
                <option value="PLAYER">{t("Oyuncu")}</option>
                <option value="SPECTATOR">{t("İzleyici (kampanya seçilmeli)")}</option>
                {isAdmin && <option value="GM">GM</option>}
              </select>
            </Field>
            <Field label={t("Geçerlilik")}>
              <select name="days" className="input" defaultValue="7">
                <option value="1">{t("1 gün")}</option>
                <option value="3">{t("{n} gün", { n: 3 })}</option>
                <option value="7">{t("{n} gün", { n: 7 })}</option>
                <option value="30">{t("{n} gün", { n: 30 })}</option>
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {t("Davet kodu üret")}
          </Button>
        </form>
        {created && (
          <div className="mt-5 rounded-lg border border-accent/40 bg-accent/10 p-4">
            <p className="text-xs text-muted">{t("Bu kod yalnızca şimdi gösterilir. Oyuncuya bağlantıyı gönder:")}</p>
            <p className="mt-2 break-all font-mono text-sm text-ink">{created}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={created} label={t("Kodu kopyala")} />
              <CopyButton text={link} label={t("Bağlantıyı kopyala")} />
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface2/60 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Kod")}</th>
                <th className="px-4 py-3 font-medium">{t("Not")}</th>
                <th className="px-4 py-3 font-medium">{t("Durum")}</th>
                <th className="px-4 py-3 font-medium">{t("Son tarih")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const expired = new Date(i.expiresAt) < new Date();
                const state = i.usedBy ? (
                  <Badge tone="ok">{t("{name} kullandı", { name: i.usedBy })}</Badge>
                ) : i.revokedAt ? (
                  <Badge tone="danger">{t("İptal edildi")}</Badge>
                ) : expired ? (
                  <Badge>{t("Süresi doldu")}</Badge>
                ) : (
                  <Badge tone="accent">{t("Bekliyor")}</Badge>
                );
                return (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted">…{i.hint}</td>
                    <td className="px-4 py-3">
                      {i.note ?? "—"}
                      <div className="text-xs text-muted">
                        {i.role === "GM" ? "GM" : i.memberRole === "SPECTATOR" ? t("İzleyici") : t("Oyuncu")}
                        {i.campaignName ? ` · ${i.campaignName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{state}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(i.expiresAt, il)}</td>
                    <td className="px-4 py-3 text-right">
                      {!i.usedBy && !i.revokedAt && !expired && (
                        <Button size="sm" variant="ghost" onClick={() => run(() => api(`/api/invites/${i.id}`, { method: "DELETE" }), t("Davet iptal edildi.")).then(load)}>
                          {t("İptal et")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!list.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    {t("Henüz davet yok.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Users({ selfId }: { selfId: string }) {
  const { run } = useAction();
  const t = useT();
  const il = intlLocale(useLocale());
  const [list, setList] = useState<UserRow[]>([]);
  const load = useCallback(() => api<{ users: UserRow[] }>("/api/users").then((r) => setList(r.users)), []);
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  return (
    <>
    {reset && (
      <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
        <p>
          {t("{name} için geçici şifre (yalnızca şimdi gösterilir, oyuncuya ilet; giriş yapınca Hesap sayfasından değiştirsin):", { name: reset.name })}
        </p>
        <p className="mt-2 font-mono text-base">{reset.password}</p>
        <div className="mt-2 flex gap-2">
          <CopyButton text={reset.password} />
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setReset(null)}>
            {t("Kapat")}
          </button>
        </div>
      </div>
    )}
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface2/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Kullanıcı")}</th>
              <th className="px-4 py-3 font-medium">{t("Rol")}</th>
              <th className="px-4 py-3 font-medium">{t("Son giriş")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3">
                  {u.displayName} <span className="text-xs text-muted">@{u.username}</span>
                  {u.disabled && (
                    <Badge tone="danger" className="ml-2">
                      {t("Devre dışı")}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">{u.isAdmin ? <Badge tone="accent">{t("Yönetici")}</Badge> : u.role === "GM" ? <Badge tone="accent">GM</Badge> : t("Oyuncu")}</td>
                <td className="px-4 py-3 text-xs text-muted">{fmtDate(u.lastLoginAt, il)}</td>
                <td className="space-x-1 px-4 py-3 text-right">
                  {u.id !== selfId && !u.isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const r = await run(() => api<{ password?: string }>(`/api/users/${u.id}`, { method: "PATCH", body: { resetPassword: true } }));
                          if (r?.password) setReset({ name: u.displayName, password: r.password });
                        }}
                      >
                        {t("Şifre sıfırla")}
                      </Button>
                      <Button
                        size="sm"
                        variant={u.disabled ? "secondary" : "danger"}
                        onClick={() => run(() => api(`/api/users/${u.id}`, { method: "PATCH", body: { disabled: !u.disabled } }), u.disabled ? t("Hesap açıldı.") : t("Hesap devre dışı bırakıldı.")).then(load)}
                      >
                        {u.disabled ? t("Etkinleştir") : t("Devre dışı bırak")}
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    </>
  );
}
