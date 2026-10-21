import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { characterLogs, users } from "@/db/schema";
import { Portrait } from "@/components/portrait";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { characterAccess, ownerCharacter } from "@/lib/access";
import { absoluteRedirect, pageUser } from "@/lib/auth/session";
import { characterHref } from "@/lib/links";
import { getTree, rulesData } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";
import { Sheet } from "./sheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Karakter") };
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getT();
  const loc = await getLocale();
  const user = await pageUser();
  const a = await characterAccess(id, user).catch(() => null);
  if (!a) notFound();
  if (a.campaign.system === "UC") await absoluteRedirect(characterHref("UC", id));
  const owner = a.character.userId ? await db.query.users.findFirst({ where: eq(users.id, a.character.userId), columns: { displayName: true } }) : null;

  if (!a.isGM && !a.isOwner) {
    const c = a.character;
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <Portrait id={c.id} version={c.portraitVersion} name={c.name} className="h-[150px] w-[120px]" />
        </div>
        <PageHeader kicker={a.campaign.name} title={c.name} actions={<StatusBadge status={c.status} />}>
          {owner?.displayName ?? t("Sahipsiz")} · {t("Seviye {n}", { n: c.level })} · {c.nationality} · {c.alignment}
          {c.languages.length > 0 && ` · ${c.languages.map((l) => t(l)).join(", ")}`}
        </PageHeader>
        <Card className="space-y-3 p-6">
          <div className="flex flex-wrap gap-2">
            {c.trees.map((tk) => (
              <Badge key={tk} tone="accent">
                {getTree(tk, loc)?.name ?? tk}
              </Badge>
            ))}
          </div>
          {c.appearance && <p className="text-ink/90">{c.appearance}</p>}
          <p className="text-sm text-muted">{t("Diğer oyuncuların karakter kağıtlarının yalnızca bu kısmı görünür.")}</p>
        </Card>
        <Link href={`/kampanya/${a.campaign.id}`} className="mt-6 inline-block text-sm text-muted hover:text-ink">
          ← {t("Kampanyaya dön")}
        </Link>
      </div>
    );
  }

  const logs = await db
    .select({ id: characterLogs.id, kind: characterLogs.kind, text: characterLogs.text, createdAt: characterLogs.createdAt, actor: users.displayName })
    .from(characterLogs)
    .leftJoin(users, eq(users.id, characterLogs.actorId))
    .where(eq(characterLogs.characterId, id))
    .orderBy(desc(characterLogs.createdAt))
    .limit(200);

  const character = a.isGM ? a.character : { ...ownerCharacter(a.character), gmNotes: "" };
  return (
    <Sheet
      character={JSON.parse(JSON.stringify(character))}
      campaign={{ id: a.campaign.id, name: a.campaign.name, deathSaveEnabled: a.campaign.deathSaveEnabled, levelCap: a.campaign.levelCap, startPerkPoints: a.campaign.startPerkPoints }}
      ownerName={owner?.displayName ?? t("Sahipsiz")}
      isGM={a.isGM}
      isOwner={a.isOwner}
      data={rulesData(loc)}
      logs={logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
    />
  );
}
