import { TopNav } from "@/components/nav";
import { RoomReturn } from "@/components/room-return";
import { currentUser } from "@/lib/auth/session";
import { content } from "@/lib/shz/content";
import { RulesNav } from "./rules-nav";

export default async function RulesLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const c = content();
  const groups = [
    {
      title: "Kurallar",
      items: [...c.docs.map((d) => ({ href: `/kurallar/${d.key}`, label: d.title, icon: d.key })), { href: "/kurallar/sozluk", label: "Sözlük", icon: "sozluk" }],
    },
    {
      title: "Karakter",
      items: [
        { href: "/kurallar/perkler", label: "Perkler", icon: "perkler" },
        { href: "/kurallar/augmentler", label: "Augmentasyonlar", icon: "augmentler" },
      ],
    },
    {
      title: "Yetenek ağaçları",
      items: [{ href: "/kurallar/yetenekler", label: "Tüm ağaçlar", icon: "yetenekler" }, ...c.trees.map((t) => ({ href: `/kurallar/yetenekler/${t.key}`, label: t.name, tree: t.key }))],
    },
    { title: "Dünya", items: [{ href: "/kurallar/kampanyalar", label: "Kampanyalar", icon: "kampanyalar" }] },
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
