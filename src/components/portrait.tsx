"use client";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { portraitUrl } from "@/lib/base";
import { api } from "@/lib/client";
import { useT } from "@/i18n/client";
import type { TFn } from "@/i18n/core";
import { useToast } from "./interactive";
import { SunLogo } from "./logo";
import { MoonLogo } from "./uc/logo";
import { cx } from "./ui";

export function Portrait({ id, version, name, className }: { id: string; version: number | null | undefined; name: string; className?: string }) {
  const t = useT();
  const url = portraitUrl(id, version);
  return (
    <div className={cx("relative shrink-0 overflow-hidden rounded-xl border border-line bg-surface2", className ?? "h-16 w-[52px]")}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={t("{name} portresi", { name })} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-accent/50">
          {/* Umbra Caelis sayfalarında (.uc-theme) hilal, diğerlerinde güneş amblemi */}
          <SunLogo className="uc-hide h-1/2 w-1/2" />
          <MoonLogo className="uc-show h-1/2 w-1/2" />
        </div>
      )}
    </div>
  );
}

const W = 400;
const H = 500;
const MAX_B64 = 230_000;

/** Seçilen görseli tarayıcıda 400×500 kırpar ve sıkıştırır; sunucu ayrıca yeniden kodlar. */
async function prepare(file: File, t: TFn): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error(t("PNG, JPEG veya WebP bir görsel seç."));
  if (file.size > 15 * 1024 * 1024) throw new Error(t("Görsel 15 MB'tan büyük olamaz."));
  const bmp = await createImageBitmap(file);
  const scale = Math.max(W / bmp.width, H / bmp.height);
  const sw = W / scale;
  const sh = H / scale;
  const sx = (bmp.width - sw) / 2;
  const sy = Math.max(0, (bmp.height - sh) / 3); // yüzler genelde üstte
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t("Tarayıcı görseli işleyemedi."));
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < MAX_B64) return url;
  }
  throw new Error(t("Görsel sıkıştırılamadı."));
}

export function PortraitEditor({
  id,
  version,
  name,
  onChange,
}: {
  id: string;
  version: number;
  name: string;
  onChange: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="group relative">
      <Portrait id={id} version={version} name={name} className="h-[150px] w-[120px]" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/60 p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white hover:bg-white/15"
          title={t("Portre yükle")}
        >
          <ImagePlus className="h-3.5 w-3.5" /> {version ? t("Değiştir") : t("Ekle")}
        </button>
        {version > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/characters/${id}/portrait`, { method: "DELETE" });
                onChange();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded px-2 py-1 text-white hover:bg-white/15"
            title={t("Portreyi kaldır")}
            aria-label={t("Portreyi kaldır")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const image = await prepare(f, t);
            await api(`/api/characters/${id}/portrait`, { method: "PUT", body: { image } });
            toast(t("Portre güncellendi."), "ok");
            onChange();
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
