import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { Card, PageHeader } from "@/components/ui";
import { pageGM } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Yeni kampanya" };

export default async function NewUcCampaign() {
  await pageGM();
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Umbra Caelis · GM" title="Yeni kampanya">
        Kampanyayı oluşturduktan sonra oyuncularına katılma kodunu gönder. Oyuncular aynı hesapla hem Schwarzesonne hem Umbra Caelis masalarına katılabilir.
      </PageHeader>
      <Card className="p-6">
        <CampaignForm presets={[]} system="UC" />
      </Card>
    </div>
  );
}
