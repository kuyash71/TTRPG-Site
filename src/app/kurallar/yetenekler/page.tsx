import type { Metadata } from "next";
import Link from "next/link";
import { Html, branchLabel } from "@/components/content/cards";
import { TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { Badge, PageHeader } from "@/components/ui";
import { tipFor } from "@/lib/shz/tips";
import { STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";

export const metadata: Metadata = { title: "Yetenek ağaçları" };

export default function TreesPage() {
  const c = content();
  return (
    <div>
      <PageHeader kicker="Ekspertiz ağaçları" title="Yetenekler">
        Her ağaçta 8 yetenek var: bir kök, kendi bitiricisiyle biten A ve B kolları ve bir alt kol. Oyuna 1 ağaçla başlarsın, ikinci ağaç yetenek puanıyla açılır.
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
                <li key={k} className="chip" title={[branchLabel(c.abilities[k]), tipFor("abilities", k)?.meaning].filter(Boolean).join(" · ")}>
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
