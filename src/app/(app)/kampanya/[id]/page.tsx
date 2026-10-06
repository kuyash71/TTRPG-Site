import { asc, eq } from "drizzle-orm";
import { Portrait } from "@/components/portrait";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { campaignMembers, characters, users } from "@/db/schema";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { Badge, Card, Empty, LinkButton, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { campaignAccess } from "@/lib/access";
import { pageUser } from "@/lib/auth/session";
import { resolveContentLinks } from "@/lib/base";
import { content, getTree } from "@/lib/shz/content";
import { ApprovalActions, CloseRoom, JoinCodeBox, LevelUpPanel, MemberRoleToggle, RemoveMember } from "./gm-tools";

export const metadata: Metadata = { title: "Kampanya" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser();
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  const { campaign: c, isGM, isSpectator } = access;
  const info = c.contentKey ? content().campaigns.find((x) => x.key === c.contentKey) : undefined;

  const chars = await db
    .select({ ch: characters, owner: users.displayName })
    .from(characters)
    .innerJoin(users, eq(users.id, characters.userId))
    .where(eq(characters.campaignId, c.id))
    .orderBy(asc(characters.createdAt));
  const members = await db
    .select({ id: users.id, displayName: users.displayName, username: users.username, role: campaignMembers.role })
    .from(campaignMembers)
    .innerJoin(users, eq(users.id, campaignMembers.userId))
    .where(eq(campaignMembers.campaignId, c.id))
    .orderBy(asc(campaignMembers.joinedAt));
  const gm = await db.query.users.findFirst({ where: eq(users.id, c.gmId), columns: { displayName: true } });

  const visible = chars.filter(({ ch }) => isGM || ch.userId === user.id || ch.status === "ACTIVE" || ch.status === "DEAD");
  const pending = chars.filter(({ ch }) => ch.status === "PENDING");
  const mine = chars.filter(({ ch }) => ch.userId === user.id && (ch.status === "ACTIVE" || ch.status === "PENDING"));
  const active = chars.filter(({ ch }) => ch.status === "ACTIVE");

  return (
    <div>
      <PageHeader
        kicker={info ? `Kampanya · ${info.difficulty} · ${info.length}` : "Kampanya"}
        title={
          <span className="flex items-center gap-4">
            {info?.emblem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/schwarzesonne${info.emblem}`} alt="" className="h-14 w-14 object-contain" />
            )}
            {c.name}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/kampanya/${c.id}/oda`} variant="primary">
              Oyun odasına gir
            </LinkButton>
            {(isGM || mine.length === 0) && !isSpectator && c.status !== "ARCHIVED" && (
              <LinkButton href={`/kampanya/${c.id}/karakter-olustur`} variant="outline">
                Karakter oluştur
              </LinkButton>
            )}
          </>
        }
      >
        <span className="text-sm">
          GM: {gm?.displayName} · Başlangıç perk puanı +{c.startPerkPoints} · Seviye sınırı {c.levelCap} · Death Save {c.deathSaveEnabled ? "açık" : "kapalı"}
        </span>
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {(c.description || info) && (
            <section className="max-w-3xl space-y-3">
              {c.description && <p className="whitespace-pre-line text-ink/90">{c.description}</p>}
              {info?.storyHtml && <div className="prose-shz text-muted" dangerouslySetInnerHTML={{ __html: resolveContentLinks(info.storyHtml) }} />}
            </section>
          )}

          {isGM && pending.length > 0 && (
            <section>
              <SectionTitle>Onay bekleyen karakterler</SectionTitle>
              <div className="space-y-3">
                {pending.map(({ ch, owner }) => (
                  <Card key={ch.id} className="flex flex-wrap items-center justify-between gap-4 border-warn/40 p-4">
                    <div>
                      <Link href={`/karakter/${ch.id}`} className="font-serif text-lg text-ink hover:text-accent">
                        {ch.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {owner} · {ch.trees.map((t) => getTree(t)?.name).join(", ")} · {ch.nationality}
                      </p>
                    </div>
                    <ApprovalActions characterId={ch.id} />
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>Parti</SectionTitle>
            {visible.length === 0 ? (
              <Empty title="Henüz karakter yok">Oyuncular katıldıktan sonra karakterlerini oluşturup onaya gönderir.</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visible.map(({ ch, owner }) => (
                  <Link key={ch.id} href={`/karakter/${ch.id}`} className="card flex items-center gap-4 p-4 transition hover:border-accent/40">
                    <Portrait id={ch.id} version={ch.portraitVersion} name={ch.name} className="h-14 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-base text-ink">{ch.name}</p>
                      <p className="truncate text-xs text-muted">
                        Sv {ch.level} · {owner} · {ch.trees.map((t) => getTree(t)?.name ?? t).join(" / ")}
                      </p>
                    </div>
                    <StatusBadge status={ch.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {isGM && (
            <section>
              <SectionTitle>Seviye atlat</SectionTitle>
              <LevelUpPanel
                campaignId={c.id}
                characters={active.map(({ ch, owner }) => ({
                  id: ch.id,
                  name: ch.name,
                  owner,
                  level: ch.level,
                  treeStat: getTree(ch.trees[0] ?? "")?.stat ?? null,
                  stats: ch.stats,
                }))}
                levelCap={c.levelCap}
              />
            </section>
          )}

          {isGM && (
            <section>
              <SectionTitle>Kampanya ayarları</SectionTitle>
              <Card className="p-6">
                <CampaignForm
                  id={c.id}
                  presets={content().campaigns}
                  initial={{
                    name: c.name,
                    contentKey: c.contentKey,
                    description: c.description,
                    startPerkPoints: c.startPerkPoints,
                    levelCap: c.levelCap,
                    deathSaveEnabled: c.deathSaveEnabled,
                    status: c.status,
                  }}
                />
              </Card>
            </section>
          )}

          {isGM && (
            <section>
              <SectionTitle>Odayı kapat</SectionTitle>
              <CloseRoom
                campaignId={c.id}
                name={c.name}
                players={members.filter((m) => m.role === "PLAYER").length}
                spectators={members.filter((m) => m.role === "SPECTATOR").length}
                characters={chars.length}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {isGM && <JoinCodeBox campaignId={c.id} code={c.joinCode} spectatorCode={c.spectatorCode} />}
          {isSpectator && (
            <Card className="border-accent/40 p-5 text-sm">
              <Badge tone="accent">İzleyici</Badge>
              <p className="mt-2 text-muted">Bu kampanyayı izliyorsun. Karakter oluşturamaz, sahneye yazamaz ve zar atamazsın; Masa sohbetine ve GM&apos;e fısıltıyla yazabilirsin.</p>
            </Card>
          )}
          <Card className="p-5">
            <p className="kicker mb-3">Oyuncular ve izleyiciler</p>
            {members.length === 0 ? (
              <p className="text-sm text-muted">Henüz kimse katılmadı.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {m.displayName} <span className="text-xs text-muted">@{m.username}</span>
                      {m.role === "SPECTATOR" && (
                        <Badge className="ml-1.5" tone="neutral">
                          İzleyici
                        </Badge>
                      )}
                    </span>
                    {isGM && (
                      <span className="flex shrink-0 items-center gap-3">
                        <MemberRoleToggle campaignId={c.id} userId={m.id} role={m.role} />
                        <RemoveMember campaignId={c.id} userId={m.id} name={m.displayName} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {c.status !== "ACTIVE" && (
              <div className="mt-3">
                <Badge tone="warn">{c.status === "PAUSED" ? "Duraklatıldı" : "Arşivlendi"}</Badge>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
