"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/components/interactive";
import { Button, Card, Empty, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { UC_STAT_KEYS, UC_STAT_LABELS, type UcStatKey } from "@/lib/uc/constants";
import { UC_STAT_MAX } from "@/lib/uc/rules";

interface LvChar {
  id: string;
  name: string;
  owner: string;
  level: number;
  /** Bir sonraki seviyenin sembol stat'ı (dal seçilmediyse null). */
  nextSymbol: { stat: UcStatKey; dal: string } | null;
  nextTier: number;
  stats: Record<UcStatKey, number>;
}

/** Umbra Caelis toplu seviye atlatma: aksiyon stat'ı + sembol stat + MVP. */
export function UcLevelUpPanel({ campaignId, characters, levelCap }: { campaignId: string; characters: LvChar[]; levelCap: number }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [sel, setSel] = useState<Record<string, UcStatKey | "">>({});
  const [mvp, setMvp] = useState<{ id: string; stat: UcStatKey | "" }>({ id: "", stat: "" });
  if (!characters.length) return <Empty title="Aktif karakter yok">Onaylanmış karakterler burada görünür.</Empty>;
  const chosen = Object.keys(sel);
  const maxLv = Math.max(0, ...characters.filter((c) => chosen.includes(c.id)).map((c) => c.level + 1));
  const ready = chosen.length > 0 && chosen.every((id) => sel[id]) && (!mvp.id || mvp.stat);
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm text-muted">
        Seçilen her karakter: <strong className="text-ink">+1 seviye</strong> ve katmanında <strong className="text-ink">+1 yetenek puanı</strong> alır. Statlar: seçtiğin{" "}
        <strong className="text-ink">aksiyon stat&apos;ı</strong> +1, puanın kazanıldığı katmandaki dalın <strong className="text-ink">sembol stat&apos;ı</strong> +1 (Sv 5 ve 10&apos;da yeni dal
        seçilince eklenir), MVP&apos;ye ayrıca +1. MVP hesabında, seviyenin 3 veya daha fazla gerisindeki oyuncular sayılmaz.
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
                  className="h-4 w-4 accent-[rgb(190,172,242)]"
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
                    {c.owner} · Sv {c.level} → {c.level + 1}
                    {c.level >= levelCap && " (sınırda)"}
                    {c.nextSymbol ? ` · sembol: ${UC_STAT_LABELS[c.nextSymbol.stat]} ${c.stats[c.nextSymbol.stat]} (${c.nextSymbol.dal})` : ` · K${c.nextTier} dalı seçilince sembol +1`}
                  </span>
                </span>
              </label>
              {on && (
                <select value={sel[c.id]} onChange={(e) => setSel((s) => ({ ...s, [c.id]: e.target.value as UcStatKey }))} className="input h-9 w-44 py-1 text-sm" aria-label={`${c.name} aksiyon stat'ı`}>
                  <option value="">Aksiyon stat&apos;ı…</option>
                  {UC_STAT_KEYS.map((k) => (
                    <option key={k} value={k} disabled={c.stats[k] >= UC_STAT_MAX}>
                      {UC_STAT_LABELS[k]} ({c.stats[k]})
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
            <select value={mvp.stat} onChange={(e) => setMvp((m) => ({ ...m, stat: e.target.value as UcStatKey }))} className="input h-9 w-44 py-1 text-sm">
              <option value="">MVP stat&apos;ı…</option>
              {UC_STAT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {UC_STAT_LABELS[k]}
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
                api(`/api/uc/campaigns/${campaignId}/level-up`, {
                  body: { entries: chosen.map((id) => ({ characterId: id, actionStat: sel[id] })), mvp: mvp.id && mvp.stat ? { characterId: mvp.id, stat: mvp.stat } : null },
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
