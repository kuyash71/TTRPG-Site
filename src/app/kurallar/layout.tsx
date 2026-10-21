import { TopNav } from "@/components/nav";
import { RoomReturn } from "@/components/room-return";
import { getLocale, getT } from "@/i18n/server";
import { currentUser } from "@/lib/auth/session";
import { content } from "@/lib/shz/content";
import { RulesNav } from "./rules-nav";

export default async function RulesLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const t = await getT();
  const c = content(await getLocale());
  const groups = [
    {
      title: t("Kurallar"),
      items: [...c.docs.map((d) => ({ href: `/kurallar/${d.key}`, label: d.title, icon: d.key })), { href: "/kurallar/sozluk", label: t("Sözlük"), icon: "sozluk" }],
    },
    {
      title: t("Karakter"),
      items: [
        { href: "/kurallar/perkler", label: t("Perkler"), icon: "perkler" },
        { href: "/kurallar/augmentler", label: t("Augmentasyonlar"), icon: "augmentler" },
      ],
    },
    {
      title: t("Yetenek ağaçları"),
      items: [{ href: "/kurallar/yetenekler", label: t("Tüm ağaçlar"), icon: "yetenekler" }, ...c.trees.map((x) => ({ href: `/kurallar/yetenekler/${x.key}`, label: x.name, tree: x.key }))],
    },
    { title: t("Dünya"), items: [{ href: "/kurallar/kampanyalar", label: t("Kampanyalar"), icon: "kampanyalar" }] },
  ];
  return (
    <>
      <TopNav user={user} />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:py-10">
        <RulesNav groups={groups} />
        <main className="min-w-0">{children}</main>
      </div>
      {user && <RoomReturn />}
    </>
  );
}
