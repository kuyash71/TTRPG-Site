import type { Metadata } from "next";
import { SunLogo } from "@/components/logo";
import { Html } from "@/components/content/cards";
import { Badge, PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Kampanyalar") };
}

export default async function CampaignsPage() {
  const t = await getT();
  const loc = await getLocale();
  return (
    <div>
      <PageHeader kicker="1955" title={t("Kampanyalar")}>
        {t("Alman iç savaşının farklı cephelerinden sekiz hikâye.")}
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {content(loc).campaigns.map((c) => (
          <article key={c.key} className="card flex gap-4 p-5">
            {c.emblem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/schwarzesonne${c.emblem}`} alt="" className="h-16 w-16 shrink-0 object-contain" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface2 text-accent"><SunLogo className="h-9 w-9" /></div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg">{c.name}</h2>
              <div className="mb-2 mt-1 flex flex-wrap gap-1.5">
                <Badge tone={/UBER|HARSH/.test(c.difficulty) ? "danger" : /MODERATE/.test(c.difficulty) ? "warn" : "ok"}>{c.difficulty}</Badge>
                <Badge>{c.length}</Badge>
              </div>
              <Html html={c.storyHtml} className="text-sm text-ink/85" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
