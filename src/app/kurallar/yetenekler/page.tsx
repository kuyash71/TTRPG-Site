import type { Metadata } from "next";
import Link from "next/link";
import { Html } from "@/components/content/cards";
import { TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { Badge, PageHeader } from "@/components/ui";
import { tipFor } from "@/lib/shz/tips";
import { STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";
import { branchLabel } from "@/lib/shz/labels";
import { getLocale, getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Yetenek ağaçları") };
}

export default async function TreesPage() {
  const tt = await getT();
  const loc = await getLocale();
  const c = content(loc);
  return (
    <div>
      <PageHeader kicker={tt("Ekspertiz ağaçları")} title={tt("Yetenekler")}>
        {tt("Her ağaçta 8 yetenek var: bir kök, kendi bitiricisiyle biten A ve B kolları ve bir alt kol. Oyuna 1 ağaçla başlarsın, ikinci ağaç yetenek puanıyla açılır.")}
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {c.trees.map((t) => (
          <Link key={t.key} href={`/kurallar/yetenekler/${t.key}`} className="card p-5 transition hover:border-accent/40">
            <div className="flex items-center gap-3">
              <TreeIcon treeKey={t.key} />
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-xl">
                  {t.name}
                  <TipButton kind="trees" id={t.key} title={t.name} />
                </h2>
                <Meaning kind="trees" id={t.key} />
              </div>
              <Badge tone="accent">{STAT_LABELS[t.stat]}</Badge>
            </div>
            <Html html={t.introHtml} className="mt-1 text-sm text-muted" />
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {t.abilities.map((k) => (
                <li key={k} className="chip" title={[branchLabel(c.abilities[k], tt), tipFor("abilities", k, loc)?.meaning].filter(Boolean).join(" · ")}>
                  {c.abilities[k].name}
                </li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
    </div>
  );
}
