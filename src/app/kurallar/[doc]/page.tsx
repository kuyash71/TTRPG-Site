import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Html } from "@/components/content/cards";
import { PageIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { content } from "@/lib/shz/content";

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  return { title: content().docs.find((d) => d.key === doc)?.title ?? "Kurallar" };
}

export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = content().docs.find((x) => x.key === doc);
  if (!d) notFound();
  return (
    <article className="max-w-3xl">
      <PageHeader
        kicker="Kurallar"
        title={
          <span className="flex items-center gap-3">
            <PageIcon page={d.key} />
            {d.title}
          </span>
        }
      />
      <Html html={d.html} />
    </article>
  );
}
