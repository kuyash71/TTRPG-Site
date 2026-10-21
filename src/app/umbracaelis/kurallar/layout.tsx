import { UcTopNav } from "@/components/uc/nav";
import { UcRulesNav, type UcNavGroup } from "@/components/uc/nav-client";
import { UC_BASE } from "@/lib/uc/constants";
import { ucContent } from "@/lib/uc/content";
import { getLocale, getT } from "@/i18n/server";

export default async function UcRulesLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const c = ucContent(await getLocale());
  const groups: UcNavGroup[] = [
    {
      title: t("Kurallar"),
      items: [...c.docs.map((d) => ({ href: `${UC_BASE}/${d.key}`, label: d.title, icon: d.key })), { href: `${UC_BASE}/sozluk`, label: t("Sözlük"), icon: "sozluk" }],
    },
    { title: t("Karakter"), items: [{ href: `${UC_BASE}/perkler`, label: t("Perkler"), icon: "perkler" }] },
    {
      title: t("Sınıflar"),
      items: [
        { href: `${UC_BASE}/siniflar`, label: t("Tüm sınıflar"), icon: "siniflar" },
        ...c.classes.flatMap((cl) => [
          { href: `${UC_BASE}/siniflar/${cl.key}`, label: cl.name, icon: cl.key },
          ...cl.dals.map((dk) => ({
            href: `${UC_BASE}/siniflar/${cl.key}/${dk}`,
            label: `${t("K{n}", { n: c.dals[dk].tier })} · ${c.dals[dk].name}`,
            sub: true,
            tier: c.dals[dk].tier,
            parent: `${UC_BASE}/siniflar/${cl.key}`,
          })),
        ]),
      ],
    },
  ];
  return (
    <>
    <UcTopNav />
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:py-10">
      <UcRulesNav groups={groups} />
      <main className="min-w-0">{children}</main>
    </div>
    </>
  );
}
