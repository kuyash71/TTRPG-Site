import { SunLogo } from "./logo";
import { MoonLogo } from "./uc/logo";

/** Giriş ekranlarının başlığı: Umbra Caelis'ten gelindiyse hilal ve altın tema, aksi halde Schwarzesonne. */
export function AuthBrand({ system = "SHZ" }: { system?: "SHZ" | "UC" }) {
  if (system === "UC")
    return (
      <div className="uc-theme mb-8 text-center">
        <MoonLogo className="mx-auto h-16 w-16 text-accent" />
        <h1 className="mt-3 font-serif text-2xl tracking-[0.12em]">UMBRA CAELIS</h1>
        <p className="mt-1 inline-block bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-onAccent">Oyun masası</p>
        <p className="mt-3 text-xs text-muted">Schwarzesonne hesabınla giriş yap; iki sistem aynı hesabı kullanır.</p>
      </div>
    );
  return (
    <div className="mb-8 text-center">
      <SunLogo className="mx-auto h-16 w-16 text-accent" />
      <h1 className="mt-3 font-serif text-2xl tracking-[0.12em]">SCHWARZESONNE</h1>
      <p lang="en" className="mt-1 inline-block bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-onAccent">
        Campaigns
      </p>
    </div>
  );
}
