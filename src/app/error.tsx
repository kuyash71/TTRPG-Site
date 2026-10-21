"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SunLogo } from "@/components/logo";
import { useT } from "@/i18n/client";

const KEY = "shz:autoReload";

/**
 * Sayfa geçişinde oluşan hataların çoğu geçicidir (yeni sürüm yayına alındıktan sonra eski
 * sayfanın artık olmayan dosyaları istemesi, kısa bağlantı kesintisi vb.) ve tam yenileme
 * ile düzelir. Bu yüzden aynı adres için 20 saniyede bir kez otomatik olarak yeniler.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    console.error(error);
    try {
      const prev = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { path: string; at: number } | null;
      const path = window.location.pathname + window.location.search;
      if (!prev || prev.path !== path || Date.now() - prev.at > 20_000) {
        sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
        setReloading(true);
        window.location.reload();
      }
    } catch {
      /* depolama kapalıysa elle yenileme seçenekleri gösterilir */
    }
  }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <SunLogo className="mx-auto h-12 w-12 animate-pulse text-accent" />
        {reloading ? (
          <p className="mt-4 text-muted">{t("Sayfa yeniden yükleniyor…")}</p>
        ) : (
          <>
            <h1 className="mt-4 text-2xl">{t("Bir şeyler ters gitti")}</h1>
            <p className="mt-2 text-muted">{t("Sayfa yüklenirken bir hata oluştu. Sayfayı yenilemek çoğu zaman yeter.")}</p>
            {error.digest && <p className="mt-1 font-mono text-xs text-muted">{t("Kod: {code}", { code: error.digest })}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-onAccent">
                {t("Sayfayı yenile")}
              </button>
              <button type="button" onClick={reset} className="rounded-lg border border-line px-4 py-2 text-sm">
                {t("Tekrar dene")}
              </button>
              <Link href="/panel" className="rounded-lg border border-line px-4 py-2 text-sm">
                {t("Panele dön")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
