import type { Metadata } from "next";
import Link from "next/link";
import { AbilityIcon, AugmentIcon, PageIcon, StatIcon, TermIcon, TreeIcon } from "@/components/content/icons";
import { PageHeader } from "@/components/ui";
import { STAT_KEYS, STAT_LABELS } from "@/lib/shz/constants";
import { content } from "@/lib/shz/content";
import { branchLabel } from "@/lib/shz/labels";
import type { Locale } from "@/i18n/core";
import { getLocale, getT } from "@/i18n/server";
import { TERM_TIPS, branchMeaning, tipFor } from "@/lib/shz/tips";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sözlük") };
}

function Row({ icon, name, href, kind, id, extra, loc }: { icon: React.ReactNode; name: string; href?: string; kind: Parameters<typeof tipFor>[0]; id: string; extra?: string; loc: Locale }) {
  const t = tipFor(kind, id, loc);
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

export default async function GlossaryPage() {
  const tt = await getT();
  const loc = await getLocale();
  const c = content(loc);
  const abilities = Object.values(c.abilities).sort((a, b) => a.name.localeCompare(b.name, "de"));
  return (
    <div className="max-w-4xl">
      <PageHeader
        kicker={tt("Yeni oyuncular için")}
        title={
          <span className="flex items-center gap-3">
            <PageIcon page="sozluk" />
            {tt("Sözlük")}
          </span>
        }
      >
        {loc === "en" ? (
          <>
            The meanings of the game&apos;s German names, their approximate pronunciation and what they do. You can see the same explanation by clicking dotted-underlined terms and stat
            names in the rules text, or the <span className="text-warn">light bulb</span> icon on cards.
          </>
        ) : (
          <>
            Oyundaki Almanca adların Türkçe anlamları, yaklaşık okunuşları ve ne işe yaradıkları. Kural metinlerinde altı noktalı terimlere ve stat adlarına, kartlarda da{" "}
            <span className="text-warn">ampul</span> simgesine tıklayarak aynı açıklamayı görebilirsin.
          </>
        )}
      </PageHeader>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">{tt("Statlar")}</h2>
        <ul className="card px-4">
          {STAT_KEYS.map((k) => (
            <Row key={k} icon={<StatIcon stat={k} />} name={STAT_LABELS[k]} kind="stats" id={k} loc={loc} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">{tt("Oyun terimleri")}</h2>
        <ul className="card px-4">
          {Object.entries(TERM_TIPS[loc]).map(([k, t]) => (
            <Row key={k} icon={<TermIcon term={k} />} name={t.match[0]} kind="terms" id={k} loc={loc} />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">{tt("Ekspertiz ağaçları ve kolları")}</h2>
        <ul className="card px-4">
          {c.trees.map((t) => {
            const branches = [...new Map(t.abilities.map((k) => c.abilities[k]).filter((a) => a.branch !== "Kök").map((a) => [a.branchName, a])).values()];
            return (
              <li key={t.key} className="border-b border-line/60 py-3 last:border-0">
                <ul>
                  <Row icon={<TreeIcon treeKey={t.key} className="h-9 w-9" />} name={t.name} href={`/kurallar/yetenekler/${t.key}`} kind="trees" id={t.key} extra={STAT_LABELS[t.stat]} loc={loc} />
                </ul>
                <p className="ml-12 mt-1 flex flex-wrap gap-1.5">
                  {branches.map((a) => (
                    <span key={a.branchName} className="chip">
                      {branchLabel(a, tt)} {branchMeaning(a.branchName, loc) && <span className="text-muted">· {branchMeaning(a.branchName, loc)}</span>}
                    </span>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">{tt("Yetenekler (A–Z)")}</h2>
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
              loc={loc}
            />
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl">{tt("Augmentler")}</h2>
        <ul className="card px-4">
          {c.augments.map((a) => (
            <Row key={a.key} icon={<AugmentIcon augmentKey={a.key} tier={a.tier ?? "T1"} className="h-9 w-9" />} name={a.name} href={`/kurallar/augmentler#${a.key}`} kind="augments" id={a.key} extra={a.tier ?? undefined} loc={loc} />
          ))}
        </ul>
      </section>
    </div>
  );
}
