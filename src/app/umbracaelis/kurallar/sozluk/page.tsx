import type { Metadata } from "next";
import { UcAbilityIcon, UcClassIcon, UcDalIcon, UcPageIcon, UcPerkIcon } from "@/components/uc/icons";
import { PageHeader } from "@/components/ui";
import { UC_BASE, UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import { ucAbilityHref, ucContent } from "@/lib/uc/content";
import { UC_TERM_TIPS, ucTipFor, type UcTipKind } from "@/lib/uc/tips";
import { Dices, ScrollText } from "lucide-react";

export const metadata: Metadata = { title: "Sözlük" };

function Row({ icon, name, href, kind, id, extra }: { icon: React.ReactNode; name: string; href?: string; kind: UcTipKind; id: string; extra?: string }) {
  const t = ucTipFor(kind, id);
  return (
    <li className="flex items-start gap-3 border-b border-line/60 py-3 last:border-0" id={`${kind}-${id}`}>
      {icon}
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-base text-ink">
          {href ? (
            <a href={href} className="hover:text-accent hover:underline">
              {name}
            </a>
          ) : (
            name
          )}
          {t?.meaning && <span className="font-sans text-sm italic text-muted">{t.meaning}</span>}
          {t?.say && <span className="font-sans text-xs text-muted">· “{t.say}”</span>}
          {extra && <span className="font-sans text-xs text-lav">{extra}</span>}
        </p>
        {t?.summary && <p className="mt-0.5 text-sm text-ink/85">{t.summary}</p>}
      </div>
    </li>
  );
}

const glyph = (I: typeof Dices, tone: string) => (
  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${tone}`} aria-hidden>
    <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
  </span>
);

export default function UcGlossaryPage() {
  const c = ucContent();
  const abilities = Object.values(c.abilities).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const dals = Object.values(c.dals);
  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: "statlar",
      title: "Statlar",
      body: UC_STAT_KEYS.map((k) => <Row key={k} icon={glyph(Dices, "border-accent/35 bg-accent/10 text-accent")} name={UC_STAT_LABELS[k]} kind="stats" id={k} />),
    },
    {
      id: "terimler",
      title: "Terimler",
      body: Object.entries(UC_TERM_TIPS)
        .sort((a, b) => a[1].match[0].localeCompare(b[1].match[0], "tr"))
        .map(([k, t]) => <Row key={k} icon={glyph(ScrollText, "border-lav/40 bg-lav/10 text-lav")} name={t.match[0]} kind="terms" id={k} />),
    },
    {
      id: "siniflar",
      title: "Sınıflar ve dallar",
      body: c.classes.flatMap((cl) => [
        <Row key={cl.key} icon={<UcClassIcon classKey={cl.key} className="h-9 w-9" />} name={cl.name} href={`${UC_BASE}/siniflar/${cl.key}`} kind="classes" id={cl.key} extra="Ana sınıf" />,
        ...dals
          .filter((d) => d.classKey === cl.key)
          .map((d) => (
            <Row key={d.key} icon={<UcDalIcon dalKey={d.key} tier={d.tier} className="h-9 w-9" />} name={d.name} href={`${UC_BASE}/siniflar/${cl.key}/${d.key}`} kind="dals" id={d.key} extra={`${cl.name} · K${d.tier}`} />
          )),
      ]),
    },
    {
      id: "yetenekler",
      title: "Yetenekler",
      body: abilities.map((a) => (
        <Row
          key={a.key}
          icon={<UcAbilityIcon type={a.type} signature={a.signature} className="h-9 w-9" />}
          name={a.name}
          href={ucAbilityHref(a)}
          kind="abilities"
          id={a.key}
          extra={`${c.dals[a.dalKey].name} · K${a.tier}`}
        />
      )),
    },
    {
      id: "perkler",
      title: "Perkler",
      body: [...c.perks]
        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        .map((p) => (
          <Row
            key={p.key}
            icon={<UcPerkIcon category={p.category} kind={p.kind} className="h-9 w-9" />}
            name={p.name}
            href={`${UC_BASE}/perkler#${p.key}`}
            kind="perks"
            id={p.key}
            extra={`${p.kind === "positive" ? "−" : "+"}${p.points} · ${p.category}`}
          />
        )),
    },
  ];
  return (
    <div className="max-w-4xl">
      <PageHeader
        kicker="Yeni oyuncular için"
        title={
          <span className="flex items-center gap-3">
            <UcPageIcon page="sozluk" />
            Sözlük
          </span>
        }
      >
        Statlar, terimler ve Latince, Almanca, İspanyolca, Japonca adların Türkçe anlamları, yaklaşık okunuşları ve ne işe yaradıkları. Kural metinlerinde altı noktalı terimlere ve stat
        adlarına, kartlarda da <span className="text-lav">ampul</span> simgesine tıklayarak aynı açıklamayı görebilirsin.
      </PageHeader>
      <nav className="mb-8 flex flex-wrap gap-2 text-sm">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line px-3 py-1 text-muted hover:border-accent/40 hover:text-ink">
            {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="mb-10 scroll-mt-24">
          <h2 className="mb-2 text-xl">{s.title}</h2>
          <ul className="card px-4">{s.body}</ul>
        </section>
      ))}
    </div>
  );
}
