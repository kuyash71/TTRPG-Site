import type { Metadata } from "next";
import { StatBadge, UcMeaning, UcTipButton } from "@/components/uc/cards";
import { UcClassIcon, UcDalIcon, UcPageIcon } from "@/components/uc/icons";
import { PageHeader } from "@/components/ui";
import { UC_BASE, UC_STAT_KEYS } from "@/lib/uc/constants";
import { ucContent } from "@/lib/uc/content";

export const metadata: Metadata = { title: "Kurallar" };

export default function UcRulesIndex() {
  const c = ucContent();
  const cards = [
    ...c.docs.map((d) => ({ href: `${UC_BASE}/${d.key}`, icon: d.key, title: d.title, text: "Temel kural metni" })),
    { href: `${UC_BASE}/siniflar`, icon: "siniflar", title: "Sınıflar", text: `${c.classes.length} ana sınıf · ${Object.keys(c.dals).length} dal · ${Object.keys(c.abilities).length} yetenek` },
    { href: `${UC_BASE}/perkler`, icon: "perkler", title: "Perkler", text: `${c.perks.filter((p) => p.kind === "positive").length} pozitif · ${c.perks.filter((p) => p.kind === "negative").length} negatif` },
    { href: `${UC_BASE}/sozluk`, icon: "sozluk", title: "Sözlük", text: "Yabancı adların anlamları, okunuşları ve ne işe yaradıkları" },
  ];
  return (
    <div>
      <PageHeader kicker="Umbra Caelis TTRPG" title="Oyuncu Kural Kitabı">
        d20 üzerine kurulu, hikâye odaklı bir sistem. Temel mekanikler, karakter yaratma, mana ve Yozlaşma, dört ana sınıf ve perkler. İçerik doğrudan GM&apos;in kural dosyalarından
        üretilir.
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((x) => (
          <a key={x.href} href={x.href} className="card flex items-start gap-4 p-5 transition hover:border-accent/45">
            <UcPageIcon page={x.icon} />
            <div className="min-w-0">
              <p className="font-serif text-lg text-ink">{x.title}</p>
              <p className="mt-1 text-sm text-muted">{x.text}</p>
            </div>
          </a>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-xl">Ana sınıflar</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {c.classes.map((cl) => (
          <a key={cl.key} href={`${UC_BASE}/siniflar/${cl.key}`} className="card group p-5 transition hover:border-accent/45">
            <div className="flex items-center gap-3">
              <UcClassIcon classKey={cl.key} />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-serif text-xl text-ink group-hover:text-accent">
                  {cl.name}
                  <UcTipButton kind="classes" id={cl.key} title={cl.name} />
                </span>
                <UcMeaning kind="classes" id={cl.key} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((t) => (
                <div key={t} className="rounded-lg border border-line bg-surface2/50 p-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">K{t}</p>
                  <ul className="space-y-1.5">
                    {cl.dals
                      .map((k) => c.dals[k])
                      .filter((d) => d.tier === t)
                      .map((d) => (
                        <li key={d.key} className="flex items-center gap-1.5 text-sm text-ink/90">
                          <UcDalIcon dalKey={d.key} tier={d.tier} className="h-6 w-6" />
                          <span className="min-w-0 truncate">{d.name}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </a>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-xl">Statlar</h2>
      <div className="flex flex-wrap gap-2">
        {UC_STAT_KEYS.map((k) => (
          <StatBadge key={k} stat={k} />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Bir stat adına tıklayınca ne işe yaradığını görürsün. Statlar 0 ile 10 arasındadır.</p>

      <p className="mt-10 text-xs text-muted">
        Sürüm {c.hash} · {new Date(c.generatedAt).toLocaleDateString("tr-TR")}
      </p>
    </div>
  );
}
