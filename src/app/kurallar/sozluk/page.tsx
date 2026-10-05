import type { Metadata } from "next";
import Link from "next/link";
import { branchLabel } from "@/components/content/cards";
import { AbilityIcon, AugmentIcon, PageIcon, StatIcon, TermIcon, TreeIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { STAT_KEYS, STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";
import { TERM_TIPS, branchMeaning, tipFor } from "@/lib/shz/tips";

export const metadata: Metadata = { title: "Sözlük" };

function Row({ icon, name, href, kind, id, extra }: { icon: React.ReactNode; name: string; href?: string; kind: Parameters<typeof tipFor>[0]; id: string; extra?: string }) {
  const t = tipFor(kind, id);
  const title = href ? (
    <Link href={href} className="hover:underline">
      {name}
    </Link>
  ) : (
    name
  );
  return (
    <li className="flex items-start gap-3 border-b border-line/60 py-3 last:border-0">
      {icon}
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-base text-ink">
          {title}
          {t?.meaning && <span className="font-sans text-sm italic text-muted">{t.meaning}</span>}
          {t?.say && <span className="font-sans text-xs text-muted">· “{t.say}”</span>}
          {extra && <span className="font-sans text-xs text-accent">{extra}</span>}
        </p>
        {t?.summary && <p className="mt-0.5 text-sm text-ink/85">{t.summary}</p>}
      </div>
    </li>
  );
}

export default function GlossaryPage() {
  const c = content();
  const abilities = Object.values(c.abilities).sort((a, b) => a.name.localeCompare(b.name, "de"));
  return (
    <div className="max-w-4xl">
      <PageHeader
        kicker="Yeni oyuncular için"
        title={
          <span className="flex items-center gap-3">
            <PageIcon page="sozluk" />
            Sözlük
          </span>
        }
      >
        Oyundaki Almanca adların Türkçe anlamları, yaklaşık okunuşları ve ne işe yaradıkları. Kural metinlerinde altı noktalı terimlere ve stat adlarına, kartlarda da{" "}
        <span className="text-warn">ampul</span> simgesine tıklayarak aynı açıklamayı görebilirsin.
      </PageHeader>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">Statlar</h2>
        <ul className="card px-4">
          {STAT_KEYS.map((k) => (
            <Row key={k} icon={<StatIcon stat={k} />} name={STAT_LABELS[k]} kind="stats" id={k} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">Oyun terimleri</h2>
        <ul className="card px-4">
          {Object.entries(TERM_TIPS).map(([k, t]) => (
            <Row key={k} icon={<TermIcon term={k} />} name={t.match[0]} kind="terms" id={k} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">Ekspertiz ağaçları ve kolları</h2>
        <ul className="card px-4">
          {c.trees.map((t) => {
            const branches = [...new Map(t.abilities.map((k) => c.abilities[k]).filter((a) => a.branch !== "Kök").map((a) => [a.branchName, a])).values()];
            return (
              <li key={t.key} className="border-b border-line/60 py-3 last:border-0">
                <ul>
                  <Row icon={<TreeIcon treeKey={t.key} className="h-9 w-9" />} name={t.name} href={`/kurallar/yetenekler/${t.key}`} kind="trees" id={t.key} extra={STAT_LABELS[t.stat]} />
                </ul>
                <p className="ml-12 mt-1 flex flex-wrap gap-1.5">
                  {branches.map((a) => (
                    <span key={a.branchName} className="chip">
                      {branchLabel(a)} {branchMeaning(a.branchName) && <span className="text-muted">· {branchMeaning(a.branchName)}</span>}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">Yetenekler (A–Z)</h2>
        <ul className="card px-4">
          {abilities.map((a) => (
            <Row
              key={a.key}
              icon={<AbilityIcon abilityKey={a.key} type={a.type} className="h-9 w-9" />}
              name={a.name}
              href={`/kurallar/yetenekler/${a.tree}#${a.key}`}
              kind="abilities"
              id={a.key}
              extra={c.trees.find((t) => t.key === a.tree)?.name}
            />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">Augmentler</h2>
        <ul className="card px-4">
          {c.augments.map((a) => (
            <Row key={a.key} icon={<AugmentIcon augmentKey={a.key} tier={a.tier ?? "T1"} className="h-9 w-9" />} name={a.name} href={`/kurallar/augmentler#${a.key}`} kind="augments" id={a.key} extra={a.tier ?? undefined} />
          ))}
        </ul>
      </section>
    </div>
  );
}
