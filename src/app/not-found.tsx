import Link from "next/link";
import { SunLogo } from "@/components/logo";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <SunLogo className="mx-auto h-14 w-14 text-accent" />
        <h1 className="mt-4 text-3xl">{t("Burada bir şey yok")}</h1>
        <p className="mt-2 text-muted">{t("Aradığın sayfa bulunamadı ya da görme iznin yok.")}</p>
        <Link href="/panel" className="mt-6 inline-block text-accent hover:underline">
          {t("Panele dön")}
        </Link>
      </div>
    </div>
  );
}
