"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton, Modal, useAction } from "@/components/interactive";
import { Button, Card, Empty, Field, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { STAT_KEYS, STAT_LABELS, STAT_MAX, type StatKey } from "@/lib/shz/constants";

export function ApprovalActions({ characterId }: { characterId: string }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const send = async (approve: boolean) => {
    const ok = await run(() => api(`/api/characters/${characterId}/review`, { body: { approve, note: note || undefined } }), approve ? "Karakter onaylandı." : "Karakter reddedildi.");
    if (ok) router.refresh();
  };
  return (
    <div className="flex gap-2">
      <Button variant="primary" size="sm" disabled={busy} onClick={() => send(true)}>
        Onayla
      </Button>
      <Button variant="danger" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
        Reddet
      </Button>
      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Karakteri reddet">
        <p className="mb-3 text-sm text-muted">Oyuncu nedenini karakter sayfasında görür ve yeni bir karakter oluşturabilir.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="input" placeholder="Neden?" />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setRejecting(false)}>Vazgeç</Button>
          <Button variant="danger" disabled={busy} onClick={() => send(false).then(() => setRejecting(false))}>
            Reddet
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function RemoveMember({ campaignId, userId, name }: { campaignId: string; userId: string; name: string }) {
  const router = useRouter();
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setOpen(true)}>
        Çıkar
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Oyuncuyu çıkar">
        <p className="text-sm text-muted">{name} kampanyadan çıkarılacak. Karakterleri silinmez ama oyuncu artık kampanyayı göremez.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Vazgeç</Button>
          <Button
            variant="danger"
            onClick={async () => {
              await run(() => api(`/api/campaigns/${campaignId}/members/${userId}`, { method: "DELETE" }), "Oyuncu çıkarıldı.");
              setOpen(false);
              router.refresh();
            }}
          >
            Çıkar
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function JoinCodeBox({ campaignId, code, spectatorCode }: { campaignId: string; code: string; spectatorCode: string | null }) {
  const router = useRouter();
  const { busy, run } = useAction();
  return (
    <Card className="space-y-5 p-5">
      <div>
        <p className="kicker mb-2">Oyuncu katılma kodu</p>
        <p className="font-mono text-2xl tracking-widest text-ink">{code}</p>
        <p className="mt-2 text-xs text-muted">Hesabı olan oyuncular bu kodla katılır. Yeni oyuncular için Yönetim sayfasından bu kampanyaya bağlı davet kodu üret.</p>
        <div className="mt-3 flex gap-2">
          <CopyButton text={code} />
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
            onClick={async () => {
              await run(() => api(`/api/campaigns/${campaignId}/join-code`, { body: {} }), "Yeni kod üretildi. Eski kod artık çalışmaz.");
              router.refresh();
            }}
          >
            Kodu yenile
          </button>
        </div>
      </div>
      <div className="border-t border-line pt-4">
        <p className="kicker mb-2">İzleyici kodu</p>
        {spectatorCode ? (
          <p className="font-mono text-2xl tracking-widest text-ink">{spectatorCode}</p>
        ) : (
          <p className="text-sm text-muted">Kapalı</p>
        )}
        <p className="mt-2 text-xs text-muted">Bu kodla katılanlar masayı izler: karakter oluşturamaz, sahneye yazamaz, zar atamaz. Masa sohbetine ve sana fısıltıyla yazabilirler.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {spectatorCode && <CopyButton text={spectatorCode} />}
          <button
            type="button"
            disabled={busy}
            className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
            onClick={async () => {
              await run(() => api(`/api/campaigns/${campaignId}/spectator-code`, { body: {} }), spectatorCode ? "Yeni izleyici kodu üretildi." : "İzleyici kodu açıldı.");
              router.refresh();
            }}
          >
            {spectatorCode ? "Kodu yenile" : "İzleyici kodu üret"}
          </button>
          {spectatorCode && (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-danger"
              onClick={async () => {
                await run(() => api(`/api/campaigns/${campaignId}/spectator-code`, { method: "DELETE" }), "İzleyici kodu kapatıldı.");
                router.refresh();
              }}
            >
              Kapat
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MemberRoleToggle({ campaignId, userId, role }: { campaignId: string; userId: string; role: "PLAYER" | "SPECTATOR" }) {
  const router = useRouter();
  const { busy, run } = useAction();
  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs text-muted hover:text-ink"
      title={role === "SPECTATOR" ? "Oyuncu yap" : "İzleyici yap"}
      onClick={async () => {
        await run(() => api(`/api/campaigns/${campaignId}/members/${userId}`, { method: "PATCH", body: { role: role === "SPECTATOR" ? "PLAYER" : "SPECTATOR" } }));
        router.refresh();
      }}
    >
      {role === "SPECTATOR" ? "Oyuncu yap" : "İzleyici yap"}
    </button>
  );
}

interface LvChar {
  id: string;
  name: string;
  owner: string;
  level: number;
  treeStat: StatKey | null;
  stats: Record<StatKey, number>;
}

export function LevelUpPanel({ campaignId, characters, levelCap }: { campaignId: string; characters: LvChar[]; levelCap: number }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [sel, setSel] = useState<Record<string, StatKey | "">>({});
  const [mvp, setMvp] = useState<{ id: string; stat: StatKey | "" }>({ id: "", stat: "" });
  if (!characters.length) return <Empty title="Aktif karakter yok">Onaylanmış karakterler burada görünür.</Empty>;
  const chosen = Object.keys(sel);
  const maxLv = Math.max(0, ...characters.filter((c) => chosen.includes(c.id)).map((c) => c.level + 1));
  const ready = chosen.length > 0 && chosen.every((id) => sel[id]) && (!mvp.id || mvp.stat);

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-muted">
        Seçilen her karakter: <strong className="text-ink">+1 seviye</strong>, <strong className="text-ink">+1 yetenek puanı</strong>, ağaç stat'ına +1 ve seçtiğin aksiyon
        stat'ına +1 alır. MVP'ye ayrıca +1. MVP hesabında, seviye atlanan seviyenin 3 veya daha fazla gerisindeki oyuncular sayılmaz.
      </p>
      <div className="space-y-2">
        {characters.map((c) => {
          const on = c.id in sel;
          const behind = on && maxLv - (c.level + 1) >= 3;
          return (
            <div key={c.id} className={cx("flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5", on ? "border-accent/50 bg-accent/5" : "border-line")}>
              <label className="flex min-w-[200px] flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[rgb(186,168,240)]"
                  checked={on}
                  disabled={c.level >= levelCap}
                  onChange={(e) =>
                    setSel((s) => {
                      const n = { ...s };
                      if (e.target.checked) n[c.id] = "";
                      else delete n[c.id];
                      return n;
                    })
                  }
                />
                <span>
                  <span className="text-ink">{c.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {c.owner} · Sv {c.level}
                    {c.level >= levelCap && " (sınırda)"}
                    {c.treeStat && ` · ağaç: ${STAT_LABELS[c.treeStat]} ${c.stats[c.treeStat]}`}
                  </span>
                </span>
              </label>
              {on && (
                <select value={sel[c.id]} onChange={(e) => setSel((s) => ({ ...s, [c.id]: e.target.value as StatKey }))} className="input h-9 w-44 py-1 text-sm">
                  <option value="">Aksiyon stat'ı…</option>
                  {STAT_KEYS.map((k) => (
                    <option key={k} value={k} disabled={c.stats[k] >= STAT_MAX}>
                      {STAT_LABELS[k]} ({c.stats[k]})
                    </option>
                  ))}
                </select>
              )}
              {behind && <span className="text-xs text-warn">MVP hesabı dışında</span>}
            </div>
          );
        })}
      </div>
      {chosen.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface2/50 px-3 py-3">
          <span className="text-sm text-ink">MVP</span>
          <select value={mvp.id} onChange={(e) => setMvp({ id: e.target.value, stat: "" })} className="input h-9 w-48 py-1 text-sm">
            <option value="">Yok</option>
            {characters
              .filter((c) => chosen.includes(c.id) && maxLv - (c.level + 1) < 3)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          {mvp.id && (
            <select value={mvp.stat} onChange={(e) => setMvp((m) => ({ ...m, stat: e.target.value as StatKey }))} className="input h-9 w-44 py-1 text-sm">
              <option value="">MVP stat'ı…</option>
              {STAT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {STAT_LABELS[k]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          disabled={!ready || busy}
          onClick={async () => {
            const ok = await run(
              () =>
                api(`/api/campaigns/${campaignId}/level-up`, {
                  body: {
                    entries: chosen.map((id) => ({ characterId: id, actionStat: sel[id] })),
                    mvp: mvp.id && mvp.stat ? { characterId: mvp.id, stat: mvp.stat } : null,
                  },
                }),
              "Seviye atlatıldı.",
            );
            if (ok) {
              setSel({});
              setMvp({ id: "", stat: "" });
              router.refresh();
            }
          }}
        >
          {chosen.length ? `${chosen.length} karakteri seviye atlat` : "Karakter seç"}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Odayı kapat: kampanyayı tüm verisiyle kalıcı olarak siler.
 * Odada oyuncu ya da izleyici kaldığı sürece düğme kapalıdır (sunucu da aynı kuralı uygular).
 */
export function CloseRoom({ campaignId, name, players, spectators, characters }: { campaignId: string; name: string; players: number; spectators: number; characters: number }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const left = players + spectators;
  const who = [players > 0 && `${players} oyuncu`, spectators > 0 && `${spectators} izleyici`].filter(Boolean).join(" ve ");
  return (
    <Card className="border-danger/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl space-y-2 text-sm">
          <p className="text-ink/90">
            Kampanya; karakterleri, sohbet ve zar geçmişiyle birlikte kalıcı olarak silinir. Katılma kodları geçersiz olur, kullanılmamış davetler iptal edilir. Yalnızca
            dondurmak istiyorsan ayarlardan durumu &quot;Arşiv&quot; yap.
          </p>
          {left > 0 ? (
            <p className="text-warn" data-testid="close-room-blocked">
              Kapatmak için önce tüm oyuncuları çıkar: {who} kaldı. &quot;Oyuncular ve izleyiciler&quot; listesindeki &quot;Çıkar&quot; ile çıkarabilirsin.
            </p>
          ) : (
            <p className="text-muted">Odada kimse kalmadı; oda kapatılabilir.</p>
          )}
        </div>
        <Button variant="danger" disabled={left > 0 || busy} onClick={() => setOpen(true)}>
          Odayı kapat
        </Button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Odayı kapat">
        <div className="space-y-4">
          <p className="text-sm text-ink/90">
            <strong>{name}</strong> kalıcı olarak kapatılacak.{" "}
            {characters > 0 ? `${characters} karakter (portre ve kayıtlarıyla), sahne mesajları` : "Sahne mesajları"}, masa sohbeti, fısıltılar ve zar geçmişi silinir. Bu işlem geri
            alınamaz.
          </p>
          <Field label="Onaylamak için kampanyanın adını yaz">
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={name} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button
              variant="danger"
              disabled={busy || confirm.trim() !== name.trim()}
              onClick={async () => {
                const ok = await run(() => api(`/api/campaigns/${campaignId}`, { method: "DELETE", body: { confirmName: confirm.trim() } }), "Oda kapatıldı.");
                if (!ok) {
                  // Bu arada biri katıldıysa sayfadaki listeyi tazele.
                  setOpen(false);
                  router.refresh();
                  return;
                }
                try {
                  const last = JSON.parse(sessionStorage.getItem("shz:lastRoom") ?? "null") as { id?: string } | null;
                  if (last?.id === campaignId) sessionStorage.removeItem("shz:lastRoom");
                } catch {
                  /* yok say */
                }
                router.replace("/panel");
                router.refresh();
              }}
            >
              Kalıcı olarak kapat
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
