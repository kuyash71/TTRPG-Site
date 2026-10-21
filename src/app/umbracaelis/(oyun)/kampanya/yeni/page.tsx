import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { Card, PageHeader } from "@/components/ui";
import { getT } from "@/i18n/server";
import { pageGM } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Yeni kampanya") };
}

export default async function NewUcCampaign() {
  await pageGM();
  const t = await getT();
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Umbra Caelis · GM" title={t("Yeni kampanya")}>
        {t("Kampanyayı oluşturduktan sonra oyuncularına katılma kodunu gönder. Oyuncular aynı hesapla hem Schwarzesonne hem Umbra Caelis masalarına katılabilir.")}
      </PageHeader>
      <Card className="p-6">
        <CampaignForm presets={[]} system="UC" />
      </Card>
    </div>
  );
}
