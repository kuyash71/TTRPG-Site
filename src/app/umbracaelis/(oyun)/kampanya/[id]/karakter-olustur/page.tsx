import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getLocale, getT } from "@/i18n/server";
import { campaignAccess } from "@/lib/access";
import { pageUser } from "@/lib/auth/session";
import { createCharHref } from "@/lib/links";
import { ucContent, ucRulesData } from "@/lib/uc/content";
import type { UcTip } from "@/lib/uc/tips";
import tipsTr from "../../../../../../../content/uc-tips.json";
import tipsEn from "../../../../../../../content/uc-tips.en.json";
import { UcWizard } from "./wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Karakter oluştur") };
}

type TipKind = "classes" | "dals" | "stats";
const pickTips = (src: unknown, kind: TipKind, keys: string[]): Record<string, UcTip> => {
  const all = ((src as Record<string, Record<string, UcTip> | undefined>)[kind] ?? {}) as Record<string, UcTip>;
  return Object.fromEntries(keys.filter((k) => all[k]).map((k) => [k, all[k]]));
};

export default async function UcCreateCharacter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const loc = await getLocale();
  const user = await pageUser({ next: `/umbracaelis/kampanya/${id}/karakter-olustur` });
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  if (access.campaign.system !== "UC") redirect(createCharHref("SHZ", id));
  if (access.isSpectator)
    return (
      <PageHeader kicker={access.campaign.name} title={t("Karakter oluştur")}>
        {t("Bu kampanyaya izleyici olarak katıldın. İzleyiciler karakter oluşturamaz; oyuncu olmak istersen GM'inden rolünü değiştirmesini iste.")}
      </PageHeader>
    );
  const content = ucContent(loc);
  const data = ucRulesData(loc);
  const k1 = Object.values(content.dals).filter((d) => d.tier === 1);
  const tipSrc = loc === "en" ? tipsEn : tipsTr;
  const tips = {
    classes: pickTips(tipSrc, "classes", content.classes.map((c) => c.key)),
    dals: pickTips(tipSrc, "dals", k1.map((d) => d.key)),
    stats: pickTips(tipSrc, "stats", Object.keys((tipSrc as { stats?: Record<string, unknown> }).stats ?? {})),
  };
  return (
    <div>
      <PageHeader kicker={`Umbra Caelis · ${access.campaign.name}`} title={t("Karakter oluştur")}>
        {t(
          "Kural kitabındaki sırayla: kozmetik bilgiler, ana sınıf, K1 dalı, perkler, diller, 2 + 2 stat ve ilk yetenek puanı. Sağdaki özet her seçimde güncellenir. Karakterin GM onayından sonra aktif olur.",
        )}
      </PageHeader>
      <UcWizard
        campaignId={id}
        startPerkPoints={access.campaign.startPerkPoints}
        data={data}
        classes={content.classes.map((c) => ({ key: c.key, name: c.name, introHtml: c.introHtml, faiths: c.faiths, faithIntroHtml: c.faithIntroHtml }))}
        perks={content.perks}
        abilities={k1.flatMap((d) => d.abilities.map((k) => content.abilities[k]))}
        tips={tips}
      />
    </div>
  );
}
