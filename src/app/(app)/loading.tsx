import { SunLogo } from "@/components/logo";
import { getT } from "@/i18n/server";

export default async function Loading() {
  const t = await getT();
  return (
    <div className="grid min-h-[50dvh] place-items-center" aria-busy="true" aria-label={t("Yükleniyor")}>
      <SunLogo className="h-10 w-10 animate-[spin_6s_linear_infinite] text-accent/70" />
    </div>
  );
}
