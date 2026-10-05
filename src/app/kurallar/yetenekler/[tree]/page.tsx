import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AbilityCard, Html } from "@/components/content/cards";
import { TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { Badge, PageHeader } from "@/components/ui";
import { STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";
import { AbilityTree } from "@/components/content/ability-tree";

export async function generateMetadata({ params }: { params: Promise<{ tree: string }> }): Promise<Metadata> {
  const { tree } = await params;
  return { title: content().trees.find((t) => t.key === tree)?.name ?? "Yetenekler" };
}

export default async function TreePage({ params }: { params: Promise<{ tree: string }> }) {
  const { tree } = await params;
  const c = content();
  const t = c.trees.find((x) => x.key === tree);
  if (!t) notFound();
  const pre = (k: string | null) => (k ? c.abilities[k]?.name : null);
  return (
    <div>
      <PageHeader
        kicker="Ekspertiz ağacı"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <TreeIcon treeKey={t.key} />
            {t.name}
            <TipButton kind="trees" id={t.key} title={t.name} />
          </span>
        }
        actions={<Badge tone="accent">{STAT_LABELS[t.stat]}</Badge>}
      >
        <Meaning kind="trees" id={t.key} className="mb-2 block text-sm" />
        <Html html={t.introHtml} />
        <p className="mt-2 text-sm">
          Almanca adların yanındaki <span className="text-warn">ampul</span> simgesine tıklayınca yeteneğin Türkçe anlamını ve ne işe yaradığını görürsün.
        </p>
      </PageHeader>
      <AbilityTree tree={t} abilities={c.abilities} render={(a) => <AbilityCard key={a.key} ability={a} prereqName={pre(a.prerequisite)} />} />
    </div>
  );
}
