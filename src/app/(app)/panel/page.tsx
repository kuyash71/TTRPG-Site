import { SystemSwitchRow } from "@/components/system-switch";
import { and, count, desc, eq, inArray, max, or } from "drizzle-orm";
import { BookOpen, Cpu, Dices, GitBranch, HelpCircle, ScrollText, Skull, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TreeIcon } from "@/components/content/icons";
import { SunLogo } from "@/components/logo";
import { Portrait } from "@/components/portrait";
import { Badge, Card, Empty, LinkButton, StatusBadge, cx } from "@/components/ui";
import { db } from "@/db";
import { campaignMembers, campaigns, characters, messages, rolls, users } from "@/db/schema";
import { pageUser } from "@/lib/auth/session";
import { CORRUPTION_MAX } from "@/lib/shz/constants";
import { content, getTree } from "@/lib/shz/content";
import { outcomeLabel } from "@/lib/shz/rules";
import { JoinCampaign } from "./join-campaign";
import { ResetRequests } from "@/components/reset-requests";
import { visibleResets } from "@/lib/password-resets";
import { intlLocale, type Locale, type TFn } from "@/i18n/core";
import { getLocale, getT, getTLoose } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Panel") };
}

function ago(d: Date | null, t: TFn, loc: Locale) {
  if (!d) return t("henüz hareket yok");
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return t("az önce");
  const m = Math.round(s / 60);
  if (m < 60) return t("{n} dk önce", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("{n} sa önce", { n: h });
  const g = Math.round(h / 24);
  return g < 30 ? t("{n} gün önce", { n: g }) : d.toLocaleDateString(intlLocale(loc));
}

export default async function Panel() {
  const user = await pageUser();
  const t = await getT();
  const tLoose = await getTLoose();
  const loc = await getLocale();
  const memberOf = db.select({ id: campaignMembers.campaignId }).from(campaignMembers).where(eq(campaignMembers.userId, user.id));
  const camps = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.system, "SHZ"), or(eq(campaigns.gmId, user.id), inArray(campaigns.id, memberOf))))
    .orderBy(desc(campaigns.createdAt));
  const ids = camps.map((c) => c.id).concat(["-"]);
  const chars = await db
    .select({ c: characters, campaignName: campaigns.name })
    .from(characters)
    .innerJoin(campaigns, eq(campaigns.id, characters.campaignId))
    .where(and(eq(characters.userId, user.id), eq(campaigns.system, "SHZ")))
    .orderBy(desc(characters.updatedAt));
  const resets = user.role === "GM" || user.isAdmin ? await visibleResets(user) : [];
  const [memberCounts, charCounts, lastMsg, lastRoll, pending, recent, gms] = await Promise.all([
    db.select({ id: campaignMembers.campaignId, n: count() }).from(campaignMembers).where(inArray(campaignMembers.campaignId, ids)).groupBy(campaignMembers.campaignId),
    db
      .select({ id: characters.campaignId, n: count() })
      .from(characters)
      .where(and(inArray(characters.campaignId, ids), eq(characters.status, "ACTIVE")))
      .groupBy(characters.campaignId),
    db.select({ id: messages.campaignId, at: max(messages.createdAt) }).from(messages).where(inArray(messages.campaignId, ids)).groupBy(messages.campaignId),
    db.select({ id: rolls.campaignId, at: max(rolls.createdAt) }).from(rolls).where(inArray(rolls.campaignId, ids)).groupBy(rolls.campaignId),
    db
      .select({ id: characters.id, campaignId: characters.campaignId })
      .from(characters)
      .where(and(eq(characters.status, "PENDING"), inArray(characters.campaignId, camps.filter((c) => c.gmId === user.id).map((c) => c.id).concat(["-"])))),
    db
      .select({ r: rolls, charName: characters.name, campaignName: campaigns.name })
      .from(rolls)
      .innerJoin(campaigns, eq(campaigns.id, rolls.campaignId))
      .leftJoin(characters, eq(characters.id, rolls.characterId))
      .where(and(inArray(rolls.campaignId, ids), or(eq(rolls.hidden, false), eq(rolls.userId, user.id), eq(campaigns.gmId, user.id))))
      .orderBy(desc(rolls.createdAt))
      .limit(6),
    db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, camps.map((c) => c.gmId).concat(["-"]))),
  ]);
  const num = (rows: { id: string; n: number }[], id: string) => rows.find((r) => r.id === id)?.n ?? 0;
  const lastAt = (id: string) => {
    const a = lastMsg.find((r) => r.id === id)?.at ?? null;
    const b = lastRoll.find((r) => r.id === id)?.at ?? null;
    return a && b ? (a > b ? a : b) : (a ?? b);
  };
  const info = new Map(content(loc).campaigns.map((c) => [c.key, c]));
  const activeChars = chars.filter(({ c }) => c.status === "ACTIVE");
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }));
  const greet = hour < 6 ? t("İyi geceler") : hour < 12 ? t("Günaydın") : hour < 18 ? t("İyi günler") : t("İyi akşamlar");
  const unspent = chars.filter(({ c }) => c.status === "ACTIVE" && (c.abilityPoints > 0 || c.freeStatPoints > 0));

  return (
    <div className="space-y-10">
      {/* karşılama */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <SunLogo className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 text-accent/[0.07]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="kicker mb-2">{t("Panel")}</p>
            <h1 className="font-serif text-3xl sm:text-4xl">
              {t("{greet}, {name}", { greet, name: user.displayName })}
            </h1>
            <p className="mt-2 max-w-xl text-muted">{t("Kampanyalarına gir, karakterlerini yönet ya da kural kitabına göz at.")}</p>
          </div>
          {user.role === "GM" && (
            <LinkButton href="/kampanya/yeni" variant="primary">
              {t("Yeni kampanya")}
            </LinkButton>
          )}
        </div>
        <div className="relative grid grid-cols-2 border-t border-line sm:grid-cols-4">
          <Stat icon={<ScrollText className="h-4 w-4" />} label={t("Kampanya")} value={camps.length} />
          <Stat icon={<Users className="h-4 w-4" />} label={user.role === "GM" ? t("Masadaki karakter") : t("Aktif karakter")} value={user.role === "GM" ? charCounts.reduce((x, r) => x + r.n, 0) : activeChars.length} />
          <Stat icon={<Sparkles className="h-4 w-4" />} label={t("Harcanmamış puan")} value={unspent.reduce((a, { c }) => a + c.abilityPoints + c.freeStatPoints, 0)} tone={unspent.length ? "accent" : undefined} />
          <Stat icon={<Skull className="h-4 w-4" />} label={user.role === "GM" ? t("Onay bekleyen") : t("Ölü karakter")} value={user.role === "GM" ? pending.length : chars.filter(({ c }) => c.status === "DEAD").length} tone={user.role === "GM" && pending.length ? "warn" : undefined} />
        </div>
      </section>

      <SystemSwitchRow to="UC" />

      <ResetRequests items={resets} />

      {unspent.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="flex-1">
            {t("{names} için harcanmamış puan var.", { names: unspent.map(({ c }) => c.name).join(", ") })}
          </span>
          <LinkButton href={`/karakter/${unspent[0].c.id}#yetenekler`} size="sm" variant="outline">
            {t("Karaktere git")}
          </LinkButton>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionHead title={t("Kampanyalar")} />
            {camps.length === 0 ? (
              <Empty title={t("Henüz bir kampanyada değilsin")}>{t("GM'inden kampanya katılma kodunu iste ve sağdaki kutuya yaz.")}</Empty>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {camps.map((c) => {
                  const ci = c.contentKey ? info.get(c.contentKey) : undefined;
                  const waiting = pending.filter((p) => p.campaignId === c.id).length;
                  const mine = chars.find((x) => x.c.campaignId === c.id && x.c.status !== "REJECTED")?.c;
                  const last = lastAt(c.id);
                  const live = !!last && Date.now() - last.getTime() < 30 * 60_000;
                  return (
                    <Card key={c.id} className="group relative flex flex-col overflow-hidden p-0 transition hover:border-accent/50">
                      <div className="flex items-start gap-4 p-5">
                        {ci?.emblem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/schwarzesonne${ci.emblem}`} alt="" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface2 text-accent">
                            <SunLogo className="h-9 w-9" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link href={`/kampanya/${c.id}`} className="block font-serif text-xl leading-tight text-ink hover:text-accent">
                            {c.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted">GM: {gms.find((g) => g.id === c.gmId)?.name ?? "—"}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {c.gmId === user.id && <Badge tone="accent">GM</Badge>}
                            {ci && <Badge>{ci.difficulty}</Badge>}
                            {c.status !== "ACTIVE" && <Badge tone="warn">{c.status === "PAUSED" ? t("Duraklatıldı") : t("Arşiv")}</Badge>}
                            {waiting > 0 && <Badge tone="warn">{t("{n} onay bekliyor", { n: waiting })}</Badge>}
                          </div>
                        </div>
                      </div>
                      {c.description && <p className="-mt-2 line-clamp-2 px-5 text-sm text-muted">{c.description}</p>}
                      <div className="mt-4 grid grid-cols-3 border-y border-line text-center text-xs">
                        <Mini label={t("Oyuncu")} value={num(memberCounts, c.id)} />
                        <Mini label={t("Karakter")} value={num(charCounts, c.id)} />
                        <div className="px-2 py-2">
                          <p className={cx("flex items-center justify-center gap-1.5 font-medium", live ? "text-ok" : "text-ink/80")}>
                            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />}
                            {live ? t("Masa canlı") : ago(last, t, loc)}
                          </p>
                          <p className="text-muted">{t("son hareket")}</p>
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap items-center gap-2 p-4">
                        <LinkButton href={`/kampanya/${c.id}/oda`} variant="primary" size="sm">
                          <Dices className="h-4 w-4" /> {t("Oyun odası")}
                        </LinkButton>
                        <LinkButton href={`/kampanya/${c.id}`} size="sm">
                          {t("Kampanya")}
                        </LinkButton>
                        {c.gmId !== user.id &&
                          (mine ? (
                            <Link href={`/karakter/${mine.id}`} className="ml-auto flex items-center gap-2 text-xs text-muted hover:text-ink">
                              <Portrait id={mine.id} version={mine.portraitVersion} name={mine.name} className="h-8 w-7" />
                              <span className="max-w-[8rem] truncate">{mine.name}</span>
                            </Link>
                          ) : (
                            <Link href={`/kampanya/${c.id}/karakter-olustur`} className="ml-auto text-xs text-accent hover:underline">
                              + {t("Karakter oluştur")}
                            </Link>
                          ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <SectionHead title={t("Karakterlerin")} />
            {chars.length === 0 ? (
              <Empty title={t("Henüz karakterin yok")}>{t("Bir kampanyaya katıldıktan sonra kampanya sayfasından karakter oluşturabilirsin.")}</Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {chars.map(({ c, campaignName }) => (
                  <Link key={c.id} href={`/karakter/${c.id}`} className={cx("card flex gap-4 p-4 transition hover:border-accent/50", c.status === "DEAD" && "opacity-70")}>
                    <Portrait id={c.id} version={c.portraitVersion} name={c.name} className={cx("h-24 w-[76px]", c.status === "DEAD" && "grayscale")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-serif text-lg leading-tight text-ink">{c.name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="truncate text-xs text-muted">
                        {t("Seviye {n}", { n: c.level })} · {campaignName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.trees.map((tk) => (
                          <span key={tk} className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-0.5 pl-0.5 pr-2 text-[11px] text-accent">
                            <TreeIcon treeKey={tk} className="h-5 w-5 rounded-full" />
                            {getTree(tk, loc)?.name ?? tk}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted">
                          <span lang="en" className="w-20">
                            Corruption
                          </span>
                          <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                            <span
                              className={cx("h-full", c.corruption === 0 ? "bg-ok/60" : c.corruption >= 7 ? "bg-danger" : c.corruption >= 4 ? "bg-warn" : "bg-accent")}
                              style={{ width: `${c.corruption === 0 ? 100 : (c.corruption / CORRUPTION_MAX) * 100}%` }}
                            />
                          </span>
                          <span className={cx("w-5 text-right font-mono", c.corruption === 0 && "text-ok")}>{c.corruption}</span>
                        </div>
                        <p className="text-[11px] text-muted">
                          <span lang="en">Inspiration</span> <span className={cx("font-mono", c.inspiration < 0 ? "text-danger" : "text-ink")}>{c.inspiration}</span>
                          {(c.abilityPoints > 0 || c.freeStatPoints > 0) && (
                            <span className="ml-2 text-accent">
                              ·{" "}
                              {c.abilityPoints > 0 && c.freeStatPoints > 0
                                ? t("{a} yetenek, {s} stat puanı", { a: c.abilityPoints, s: c.freeStatPoints })
                                : c.abilityPoints > 0
                                  ? t("{n} yetenek puanı", { n: c.abilityPoints })
                                  : t("{n} stat puanı", { n: c.freeStatPoints })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <JoinCampaign />
          <Card className="p-5">
            <p className="kicker mb-3">{t("Son zarlar")}</p>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">{t("Henüz zar atılmadı.")}</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map(({ r, charName, campaignName }) => {
                  const d = r.detail;
                  const good = ["success", "crit-success", "save"].includes(d.outcome);
                  const bad = ["fail", "crit-fail", "death"].includes(d.outcome);
                  return (
                    <li key={r.id} className="flex items-center gap-3">
                      <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-sm font-semibold", good ? "bg-ok/15 text-ok" : bad ? "bg-danger/15 text-danger" : "bg-surface2 text-ink")}>{d.total}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">
                          {charName ?? "GM"} · {tLoose(r.label)}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {t(outcomeLabel(d.outcome) || "Sonuç")} · {campaignName} · {ago(r.createdAt, t, loc)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="kicker mb-3">{t("Kural kitabı")}</p>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink href="/kurallar" icon={<BookOpen className="h-4 w-4" />} label={t("Temel kurallar")} />
              <QuickLink href="/kurallar/yetenekler" icon={<GitBranch className="h-4 w-4" />} label={t("Yetenek ağaçları")} />
              <QuickLink href="/kurallar/perkler" icon={<Sparkles className="h-4 w-4" />} label={t("Perkler")} />
              <QuickLink href="/kurallar/augmentler" icon={<Cpu className="h-4 w-4" />} label={t("Augmentler")} />
              <QuickLink href="/kurallar/kampanyalar" icon={<ScrollText className="h-4 w-4" />} label={t("Kampanyalar")} />
              <QuickLink href="/yardim" icon={<HelpCircle className="h-4 w-4" />} label={t("Yardım")} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "accent" | "warn" }) {
  return (
    <div className="border-line px-5 py-4 [&:not(:first-child)]:border-l max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </p>
      <p className={cx("mt-1 font-mono text-2xl", tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn" : "text-ink")}>{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-line px-2 py-2">
      <p className="font-mono text-base text-ink">{value}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="font-serif text-2xl">{title}</h2>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-lg border border-line bg-surface2/40 px-3 py-2.5 text-sm text-ink/90 transition hover:border-accent/50 hover:text-ink">
      <span className="text-accent">{icon}</span>
      {label}
    </Link>
  );
}

