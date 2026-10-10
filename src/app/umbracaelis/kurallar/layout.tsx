import { UcRulesNav, type UcNavGroup } from "@/components/uc/nav-client";
import { UC_BASE } from "@/lib/uc/constants";
import { ucContent } from "@/lib/uc/content";

export default function UcRulesLayout({ children }: { children: React.ReactNode }) {
  const c = ucContent();
  const groups: UcNavGroup[] = [
    {
      title: "Kurallar",
      items: [...c.docs.map((d) => ({ href: `${UC_BASE}/${d.key}`, label: d.title, icon: d.key })), { href: `${UC_BASE}/sozluk`, label: "Sözlük", icon: "sozluk" }],
    },
    { title: "Karakter", items: [{ href: `${UC_BASE}/perkler`, label: "Perkler", icon: "perkler" }] },
    {
      title: "Sınıflar",
      items: [
        { href: `${UC_BASE}/siniflar`, label: "Tüm sınıflar", icon: "siniflar" },
        ...c.classes.flatMap((cl) => [
          { href: `${UC_BASE}/siniflar/${cl.key}`, label: cl.name, icon: cl.key },
          ...cl.dals.map((dk) => ({
            href: `${UC_BASE}/siniflar/${cl.key}/${dk}`,
            label: `K${c.dals[dk].tier} · ${c.dals[dk].name}`,
            sub: true,
            tier: c.dals[dk].tier,
            parent: `${UC_BASE}/siniflar/${cl.key}`,
          })),
        ]),
      ],
    },
  ];
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:py-10">
      <UcRulesNav groups={groups} />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
