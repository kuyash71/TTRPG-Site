import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UcHtml } from "@/components/uc/cards";
import { UcPageIcon } from "@/components/uc/icons";
import { PageHeader } from "@/components/ui";
import { ucContent } from "@/lib/uc/content";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const t = await getT();
  return { title: ucContent(await getLocale()).docs.find((d) => d.key === doc)?.title ?? t("Kurallar") };
}

export default async function UcDocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const t = await getT();
  const d = ucContent(await getLocale()).docs.find((x) => x.key === doc);
  if (!d) notFound();
  return (
    <article className="max-w-3xl">
      <PageHeader
        kicker={t("Kurallar")}
        title={
          <span className="flex items-center gap-3">
            <UcPageIcon page={d.key} />
            {d.title}
          </span>
        }
      />
      <UcHtml html={d.html} />
    </article>
  );
}
