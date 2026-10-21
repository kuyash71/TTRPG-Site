import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { campaignAccess } from "@/lib/access";
import { absoluteRedirect, pageUser } from "@/lib/auth/session";
import { createCharHref } from "@/lib/links";
import { rulesData } from "@/lib/shz/content";
import { Wizard } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Karakter oluştur") };
}

export default async function CreateCharacter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const loc = await getLocale();
  const user = await pageUser();
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  if (access.campaign.system === "UC") await absoluteRedirect(createCharHref("UC", id));
  if (access.isSpectator)
    return (
      <div>
        <PageHeader kicker={access.campaign.name} title={t("Karakter oluştur")}>
          {t(
            "Bu kampanyaya izleyici olarak katıldın. İzleyiciler karakter oluşturamaz, sahneye yazamaz ve zar atamaz; masayı izleyebilir, Masa (OOC) sohbetine ve GM'e fısıltıyla yazabilir. Oyuncu olmak istersen GM'inden rolünü değiştirmesini iste.",
          )}
        </PageHeader>
      </div>
    );
  return (
    <div>
      <PageHeader kicker={access.campaign.name} title={t("Karakter oluştur")}>
        {t("Adımları sırayla doldur. Sağdaki özet her seçimde güncellenir; sorun varsa orada yazar. Karakterin GM onayından sonra aktif olur.")}
      </PageHeader>
      <Wizard campaignId={id} startPerkPoints={access.campaign.startPerkPoints} data={rulesData(loc)} />
    </div>
  );
}
