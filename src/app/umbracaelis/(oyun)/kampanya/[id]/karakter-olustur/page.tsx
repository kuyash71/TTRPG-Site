import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { campaignAccess } from "@/lib/access";
import { pageUser } from "@/lib/auth/session";
import { createCharHref } from "@/lib/links";
import { ucContent, ucRulesData } from "@/lib/uc/content";
import { UcWizard } from "./wizard";

export const metadata: Metadata = { title: "Karakter oluştur" };

export default async function UcCreateCharacter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser({ next: `/umbracaelis/kampanya/${id}/karakter-olustur` });
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  if (access.campaign.system !== "UC") redirect(createCharHref("SHZ", id));
  if (access.isSpectator)
    return (
      <PageHeader kicker={access.campaign.name} title="Karakter oluştur">
        Bu kampanyaya izleyici olarak katıldın. İzleyiciler karakter oluşturamaz; oyuncu olmak istersen GM&apos;inden rolünü değiştirmesini iste.
      </PageHeader>
    );
  const content = ucContent();
  const k1 = Object.values(content.dals).filter((d) => d.tier === 1);
  return (
    <div>
      <PageHeader kicker={`Umbra Caelis · ${access.campaign.name}`} title="Karakter oluştur">
        Kural kitabındaki sırayla: kozmetik bilgiler, ana sınıf, K1 dalı, perkler, diller, 2 + 2 stat ve ilk yetenek puanı. Sağdaki özet her seçimde güncellenir. Karakterin GM
        onayından sonra aktif olur.
      </PageHeader>
      <UcWizard
        campaignId={id}
        startPerkPoints={access.campaign.startPerkPoints}
        data={ucRulesData()}
        classes={content.classes.map((c) => ({ key: c.key, name: c.name, introHtml: c.introHtml }))}
        perks={content.perks}
        abilities={k1.flatMap((d) => d.abilities.map((k) => content.abilities[k]))}
      />
    </div>
  );
}
