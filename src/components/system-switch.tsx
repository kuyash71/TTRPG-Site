import { ArrowRight } from "lucide-react";
import { SunLogo } from "./logo";
import { getT } from "@/i18n/server";
import { MoonLogo } from "./uc/logo";

/** Panelin altındaki geniş sistem geçiş satırı (aynı hesapla diğer oyuna geçer). */
export async function SystemSwitchRow({ to }: { to: "UC" | "SHZ" }) {
  const t = await getT();
  const uc = to === "UC";
  return (
    <a
      href={uc ? "/umbracaelis/panel" : "/schwarzesonne/panel"}
      data-testid="system-switch"
      className="group flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:border-accent/50 hover:bg-surface2/60"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
        {uc ? <MoonLogo className="h-7 w-7" /> : <SunLogo className="h-7 w-7" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-lg text-ink group-hover:text-accent">{uc ? t("Umbra Caelis'e geç") : t("Schwarzesonne'ye geç")}</span>
        <span className="block text-sm text-muted">{uc ? t("Aynı hesapla Umbra Caelis oyun masasına git.") : t("Aynı hesapla Schwarzesonne paneline dön.")}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
    </a>
  );
}
