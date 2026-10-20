import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApprovalActions, CloseRoom, JoinCodeBox, MemberRoleToggle, RemoveMember, TransferOwner } from "@/app/(app)/kampanya/[id]/gm-tools";
import { CampaignForm } from "@/components/campaign/campaign-form";
import { Portrait } from "@/components/portrait";
import { Badge, Card, Empty, LinkButton, PageHeader, SectionTitle, StatusBadge } from "@/components/ui";
import { UcLevelUpPanel } from "@/components/uc/game/level-up";
import { db } from "@/db";
import { campaignMembers, characters, users } from "@/db/schema";
import { campaignAccess } from "@/lib/access";
import { pageUser } from "@/lib/auth/session";
import { campaignHref } from "@/lib/links";
import { asUcChar } from "@/lib/uc/char";
import { ucRulesData } from "@/lib/uc/content";
import { ucDalOfTier, ucTierOfLevel } from "@/lib/uc/rules";

export const metadata: Metadata = { title: "Kampanya" };

export default async function UcCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser({ next: `/umbracaelis/kampanya/${id}` });
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  const { campaign: c, isGM, isSpectator } = access;
  if (c.system !== "UC") redirect(campaignHref("SHZ", c.id));
  const data = ucRulesData();
  const chars = await db
    .select({ ch: characters, ownerName: users.displayName })
    .from(characters)
    .leftJoin(users, eq(users.id, characters.userId))
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
  const dalLine = (trees: string[]) => trees.map((t) => `K${data.dals[t]?.tier} ${data.dals[t]?.name ?? t}`).join(" / ");
  const className = (k?: string) => data.classes.find((x) => x.key === k)?.name ?? "—";

  return (
    <div>
      <PageHeader
        kicker="Umbra Caelis · Kampanya"
        title={c.name}
        actions={
          <>
            <LinkButton href={`/umbracaelis/kampanya/${c.id}/oda`} variant="primary">
              Oyun odasına gir
            </LinkButton>
            {(isGM || mine.length === 0) && !isSpectator && c.status !== "ARCHIVED" && (
              <LinkButton href={`/umbracaelis/kampanya/${c.id}/karakter-olustur`} variant="outline">
                Karakter oluştur
              </LinkButton>
            )}
          </>
        }
      >
        <span className="text-sm">
          GM: {gm?.displayName} · Başlangıç perk puanı +{c.startPerkPoints} · Seviye sınırı {c.levelCap} · Death Save {c.deathSaveEnabled ? "açık" : "kapalı"}
          {c.physicalDice && " · Fiziksel zar"}
        </span>
      </PageHeader>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          {c.description && <p className="max-w-3xl whitespace-pre-line text-ink/90">{c.description}</p>}

          {isGM && pending.length > 0 && (
            <section>
              <SectionTitle>Onay bekleyen karakterler</SectionTitle>
              <div className="space-y-3">
                {pending.map(({ ch, ownerName }) => (
                  <Card key={ch.id} className="flex flex-wrap items-center justify-between gap-4 border-warn/40 p-4">
                    <div>
                      <a href={`/umbracaelis/karakter/${ch.id}`} className="font-serif text-lg text-ink hover:text-accent">
                        {ch.name}
                      </a>
                      <p className="text-sm text-muted">
                        {ownerName ?? "Sahipsiz"} · {className(ch.uc?.classKey)} · {dalLine(ch.trees)} · {ch.nationality}
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
                {visible.map((row) => {
                  const { ch } = row;
                  return (
                    <div key={ch.id} className="card flex items-center gap-4 p-4 transition hover:border-accent/40">
                      <a href={`/umbracaelis/karakter/${ch.id}`} className="shrink-0">
                        <Portrait id={ch.id} version={ch.portraitVersion} name={ch.name} className="h-14 w-11" />
                      </a>
                      <div className="min-w-0 flex-1">
                        <a href={`/umbracaelis/karakter/${ch.id}`} className="block truncate font-serif text-base text-ink hover:text-accent">
                          {ch.name}
                        </a>
                        <p className="truncate text-xs text-muted">
                          Sv {ch.level} · <span className={row.ownerName ? undefined : "text-warn"}>{row.ownerName ?? "Sahipsiz"}</span> · {className(ch.uc?.classKey)} · {dalLine(ch.trees)}
                        </p>
                        {ch.languages.length > 0 && <p className="truncate text-[11px] text-muted">Diller: {ch.languages.join(", ")}</p>}
                        {isGM && (
                          <TransferOwner
                            characterId={ch.id}
                            characterName={ch.name}
                            ownerId={ch.userId}
                            options={[{ id: c.gmId, name: `${gm?.displayName ?? "GM"} (GM)` }, ...members.filter((m) => m.role === "PLAYER").map((m) => ({ id: m.id, name: m.displayName }))]}
                          />
                        )}
                      </div>
                      <StatusBadge status={ch.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {isGM && (
            <section>
              <SectionTitle>Seviye atlat</SectionTitle>
              <UcLevelUpPanel
                campaignId={c.id}
                levelCap={c.levelCap}
                characters={active.map((row) => {
                  const u = asUcChar(row.ch);
                  const tier = ucTierOfLevel(row.ch.level + 1);
                  const dal = ucDalOfTier(u, tier, data);
                  return {
                    id: row.ch.id,
                    name: row.ch.name,
                    owner: row.ownerName ?? "Sahipsiz",
                    level: row.ch.level,
                    nextTier: tier,
                    nextSymbol: dal ? { stat: dal.stat, dal: dal.name } : null,
                    stats: u.stats,
                  };
                })}
              />
            </section>
          )}

          {isGM && (
            <section>
              <SectionTitle>Kampanya ayarları</SectionTitle>
              <Card className="p-6">
                <CampaignForm
                  id={c.id}
                  presets={[]}
                  system="UC"
                  initial={{
                    name: c.name,
                    contentKey: null,
                    description: c.description,
                    startPerkPoints: c.startPerkPoints,
                    levelCap: c.levelCap,
                    deathSaveEnabled: c.deathSaveEnabled,
                    physicalDice: c.physicalDice,
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
                afterHref="/umbracaelis/panel"
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
