import type { Metadata } from "next";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { Card, PageHeader } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { pageGM } from "@/lib/auth/session";
import { content } from "@/lib/shz/content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Yeni kampanya") };
}

export default async function NewCampaign() {
  await pageGM();
  const t = await getT();
  const loc = await getLocale();
  return (
    <div className="max-w-5xl">
      <PageHeader kicker="GM" title={t("Yeni kampanya")}>
        {t("Kampanyayı oluşturduktan sonra oyuncularına katılma kodunu ya da kampanyaya bağlı bir davet kodu gönder.")}
      </PageHeader>
      <Card className="p-6">
        <CampaignForm presets={content(loc).campaigns} />
      </Card>
    </div>
  );
}
