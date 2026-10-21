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
import { absoluteRedirect, pageUser } from "@/lib/auth/session";
import { campaignHref } from "@/lib/links";
import { resolveContentLinks } from "@/lib/base";
import { content, getTree } from "@/lib/shz/content";
import { getLocale, getT } from "@/i18n/server";
import { ApprovalActions, CloseRoom, JoinCodeBox, LevelUpPanel, MemberRoleToggle, RemoveMember, TransferOwner } from "./gm-tools";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Kampanya") };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser();
  const t = await getT();
  const loc = await getLocale();
  const access = await campaignAccess(id, user).catch(() => null);
  if (!access) notFound();
  const { campaign: c, isGM, isSpectator } = access;
  if (c.system === "UC") await absoluteRedirect(campaignHref("UC", c.id));
  const info = c.contentKey ? content(loc).campaigns.find((x) => x.key === c.contentKey) : undefined;

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

  const ownerOf = (x: { ownerName: string | null }) => x.ownerName ?? t("Sahipsiz");
  const visible = chars.filter(({ ch }) => isGM || ch.userId === user.id || ch.status === "ACTIVE" || ch.status === "DEAD");
  const pending = chars.filter(({ ch }) => ch.status === "PENDING");
  const mine = chars.filter(({ ch }) => ch.userId === user.id && (ch.status === "ACTIVE" || ch.status === "PENDING"));
  const active = chars.filter(({ ch }) => ch.status === "ACTIVE");

  return (
    <div>
      <PageHeader
        kicker={info ? `${t("Kampanya")} · ${info.difficulty} · ${info.length}` : t("Kampanya")}
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
              {t("Oyun odasına gir")}
            </LinkButton>
            {(isGM || mine.length === 0) && !isSpectator && c.status !== "ARCHIVED" && (
              <LinkButton href={`/kampanya/${c.id}/karakter-olustur`} variant="outline">
                {t("Karakter oluştur")}
              </LinkButton>
            )}
          </>
        }
      >
        <span className="text-sm">
          GM: {gm?.displayName} · {t("Başlangıç perk puanı +{n}", { n: c.startPerkPoints })} · {t("Seviye sınırı {n}", { n: c.levelCap })} ·{" "}
          {c.deathSaveEnabled ? t("Death Save açık") : t("Death Save kapalı")}
          {c.physicalDice && ` · ${t("Fiziksel zar")}`}
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
              <SectionTitle>{t("Onay bekleyen karakterler")}</SectionTitle>
              <div className="space-y-3">
                {pending.map(({ ch, ownerName }) => (
                  <Card key={ch.id} className="flex flex-wrap items-center justify-between gap-4 border-warn/40 p-4">
                    <div>
                      <Link href={`/karakter/${ch.id}`} className="font-serif text-lg text-ink hover:text-accent">
                        {ch.name}
                      </Link>
                      <p className="text-sm text-muted">
                        {ownerName ?? t("Sahipsiz")} · {ch.trees.map((tk) => getTree(tk, loc)?.name).join(", ")} · {ch.nationality}
                      </p>
                    </div>
                    <ApprovalActions characterId={ch.id} />
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionTitle>{t("Parti")}</SectionTitle>
            {visible.length === 0 ? (
              <Empty title={t("Henüz karakter yok")}>{t("Oyuncular katıldıktan sonra karakterlerini oluşturup onaya gönderir.")}</Empty>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visible.map((row) => {
                  const { ch } = row;
                  return (
                    <div key={ch.id} className="card flex items-center gap-4 p-4 transition hover:border-accent/40">
                      <Link href={`/karakter/${ch.id}`} className="shrink-0">
                        <Portrait id={ch.id} version={ch.portraitVersion} name={ch.name} className="h-14 w-11" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/karakter/${ch.id}`} className="block truncate font-serif text-base text-ink hover:text-accent">
                          {ch.name}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {t("Sv {n}", { n: ch.level })} · <span className={row.ownerName ? undefined : "text-warn"}>{ownerOf(row)}</span> · {ch.trees.map((tk) => getTree(tk, loc)?.name ?? tk).join(" / ")}
                        </p>
                        {ch.languages.length > 0 && <p className="truncate text-[11px] text-muted" >{t("Diller: {list}", { list: ch.languages.join(", ") })}</p>}
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
              <SectionTitle>{t("Seviye atlat")}</SectionTitle>
              <LevelUpPanel
                campaignId={c.id}
                characters={active.map((row) => ({
                  id: row.ch.id,
                  name: row.ch.name,
                  owner: ownerOf(row),
                  level: row.ch.level,
                  treeStat: getTree(row.ch.trees[0] ?? "", loc)?.stat ?? null,
                  stats: row.ch.stats,
                }))}
                levelCap={c.levelCap}
              />
            </section>
          )}

          {isGM && (
            <section>
              <SectionTitle>{t("Kampanya ayarları")}</SectionTitle>
              <Card className="p-6">
                <CampaignForm
                  id={c.id}
                  presets={content(loc).campaigns}
                  initial={{
                    name: c.name,
                    contentKey: c.contentKey,
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
              <SectionTitle>{t("Odayı kapat")}</SectionTitle>
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
              <Badge tone="accent">{t("İzleyici")}</Badge>
              <p className="mt-2 text-muted">{t("Bu kampanyayı izliyorsun. Karakter oluşturamaz, sahneye yazamaz ve zar atamazsın; Masa sohbetine ve GM'e fısıltıyla yazabilirsin.")}</p>
            </Card>
          )}
          <Card className="p-5">
            <p className="kicker mb-3">{t("Oyuncular ve izleyiciler")}</p>
            {members.length === 0 ? (
              <p className="text-sm text-muted">{t("Henüz kimse katılmadı.")}</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {m.displayName} <span className="text-xs text-muted">@{m.username}</span>
                      {m.role === "SPECTATOR" && (
                        <Badge className="ml-1.5" tone="neutral">
                          {t("İzleyici")}
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
                <Badge tone="warn">{c.status === "PAUSED" ? t("Duraklatıldı") : t("Arşivlendi")}</Badge>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
