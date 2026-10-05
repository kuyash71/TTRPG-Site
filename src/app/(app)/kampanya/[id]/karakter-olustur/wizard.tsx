"use client";
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AbilityCard, AugmentCard, Html, PerkCard, branchLabel } from "@/components/content/cards";
import { TreeIcon } from "@/components/content/icons";
import { Meaning, TipButton } from "@/components/content/tip";
import { useAction } from "@/components/interactive";
import { Badge, Button, Card, Field, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { BodyDiagram } from "@/components/body-diagram";
import {
  AGE_MAX,
  AGE_MIN,
  AMPUTABLE_PARTS,
  KRIEGSVERSEHRT,
  LIMB_CHILD,
  LIMB_PARENT,
  START_FREE_STATS,
  STAT_HINTS,
  STAT_KEYS,
  STAT_LABELS,
  STAT_MAX,
  bodyPartLabel,
  type BodyPartKey,
} from "@/lib/shz/constants";
import type { RulesData } from "@/lib/shz/content";
import { amputationPlan, buildCreation, effectiveStats, learnState, type Stats } from "@/lib/shz/rules";

const STEP_LABELS = { kimlik: "Kimlik", ekspertiz: "Ekspertiz", perkler: "Perkler", augment: "Augment", statlar: "Statlar", yetenek: "İlk yetenek", ozet: "Özet" } as const;
type StepKey = keyof typeof STEP_LABELS;
const KV = KRIEGSVERSEHRT.perk;

interface Identity {
  name: string;
  age: number;
  nationality: string;
  alignment: string;
  background: string;
  appearance: string;
  secretNotes: string;
}

export function Wizard({ campaignId, startPerkPoints, data }: { campaignId: string; startPerkPoints: number; data: RulesData }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [cur, setCur] = useState<StepKey>("kimlik");
  const [id, setId] = useState<Identity>({ name: "", age: 30, nationality: "", alignment: "", background: "", appearance: "", secretNotes: "" });
  const [tree, setTree] = useState("");
  const [aug, setAug] = useState<{ key: string; part: string } | null>(null);
  const [amp, setAmp] = useState<BodyPartKey[]>([]);
  const [perks, setPerks] = useState<string[]>([]);
  const [points, setPoints] = useState<Partial<Stats>>({});
  const [first, setFirst] = useState<string | null>(null);
  const [perkFilter, setPerkFilter] = useState("");
  const [perkTab, setPerkTab] = useState<"positive" | "negative" | "selected">("positive");

  const T = data.trees.find((t) => t.key === tree);
  const result = useMemo(
    () => buildCreation({ tree, points, perks, startAugment: aug, firstAbility: first, amputation: perks.includes(KV) ? amp : null }, startPerkPoints, data),
    [tree, points, perks, aug, first, amp, startPerkPoints, data],
  );
  const budget = result.budget;
  const totalPoints = START_FREE_STATS + budget.convertible;
  const used = Object.values(points).reduce((a, b) => a + (b ?? 0), 0);
  const treeCap = budget.convertible;
  const perkName = useMemo(() => new Map(data.perks.map((p) => [p.key, p.name])), [data.perks]);
  // Perk ve augment etkileriyle birlikte gerçek değerler (negatife inebilir).
  const eff = useMemo(() => effectiveStats({ stats: result.stats, body: result.body, corruption: result.corruption, perks }, data), [result, perks, data]);

  const idOk = id.name.trim().length >= 2 && id.nationality.trim().length >= 2 && id.alignment.trim().length >= 2 && id.age >= AGE_MIN && id.age <= AGE_MAX;
  const needsAug = T?.startBonus.kind === "augment";
  const ampPlan = amputationPlan(amp);
  const ampOk = !perks.includes(KV) || ampPlan.problems.length === 0;
  const augProblem = result.problems.find((p) => /augment/i.test(p));
  const STEPS: StepKey[] = ["kimlik", "ekspertiz", "perkler", ...(needsAug ? (["augment"] as const) : []), "statlar", "yetenek", "ozet"];
  const okMap: Record<StepKey, boolean> = {
    kimlik: idOk,
    ekspertiz: !!T,
    perkler: budget.problems.length === 0 && ampOk,
    augment: !!aug && !augProblem,
    statlar: used === totalPoints && (!T || (points[T.stat] ?? 0) <= treeCap),
    yetenek: true,
    ozet: result.ok && idOk,
  };
  const stepOk = STEPS.map((k) => okMap[k]);
  const step = Math.max(0, STEPS.indexOf(cur));
  const setStep = (v: number | ((n: number) => number)) => setCur(STEPS[Math.min(STEPS.length - 1, Math.max(0, typeof v === "function" ? v(step) : v))]);

  // Perk ya da ağaç değişince stat dağılımı geçersiz kalabilir: sıfırla.
  const togglePerk = (k: string) => {
    setPerks((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
    if (k === KV) setAmp([]);
    setPoints({});
    setFirst(null);
  };
  const toggleAmp = (k: BodyPartKey) => {
    const next = amp.includes(k) ? amp.filter((x) => x !== k) : [...amp, k];
    setAmp(next);
    setPoints({});
    // Seçilen augment artık kopuk bir uzvun altına düşüyorsa kaldır
    if (aug) {
      const parent = LIMB_PARENT[aug.part as BodyPartKey];
      if (parent && next.includes(parent)) setAug(null);
    }
  };
  const chooseTree = (k: string) => {
    setTree(k);
    setAug(null);
    setPoints({});
    setFirst(null);
  };

  const charForAbilities = {
    level: 0,
    stats: result.stats,
    trees: tree ? [tree] : [],
    abilities: {},
    perks,
    body: result.body,
    corruption: result.corruption,
    inspiration: 0,
    abilityPoints: 1,
  };
  const q = perkFilter.toLocaleLowerCase("tr-TR");
  const visiblePerks = data.perks.filter(
    (p) => (perkTab === "selected" ? perks.includes(p.key) : p.kind === perkTab) && (!q || p.searchText.includes(q)),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <ol className="mb-6 flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <li key={s} className="shrink-0">
              <button
                type="button"
                onClick={() => (i <= step || stepOk.slice(0, i).every(Boolean) ? setStep(i) : undefined)}
                className={cx(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                  i === step ? "border-accent bg-accent/15 text-ink" : stepOk[i] && i < step ? "border-ok/40 text-ok" : "border-line text-muted",
                )}
              >
                <span className="font-mono">{i + 1}</span> {STEP_LABELS[s]}
              </button>
            </li>
          ))}
        </ol>

        {cur === "kimlik" && (
          <Card className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Karakter adı" hint="Milliyetine uygun bir isim seçmek iyi olur">
                <input className="input" value={id.name} maxLength={60} onChange={(e) => setId({ ...id, name: e.target.value })} />
              </Field>
              <Field label="Yaş" hint={`${AGE_MIN}–${AGE_MAX} arası`}>
                <input type="number" min={AGE_MIN} max={AGE_MAX} className="input" value={id.age} onChange={(e) => setId({ ...id, age: Number(e.target.value) })} />
              </Field>
              <Field label="Milliyet" hint="Irk ve milliyet RP içinde iletişimi etkileyebilir">
                <input className="input" value={id.nationality} maxLength={60} onChange={(e) => setId({ ...id, nationality: e.target.value })} />
              </Field>
              <Field label="Taraf" hint="Alignment: karakterin genel faction bilgisi (ör. Wehrmacht sadıkı, direnişçi)">
                <input className="input" value={id.alignment} maxLength={60} onChange={(e) => setId({ ...id, alignment: e.target.value })} />
              </Field>
            </div>
            <Field label="Geçmiş" hint="Partideki herkesin bilebileceği hikâye: nereden geliyor, ne istiyor?">
              <textarea className="input" rows={5} maxLength={4000} value={id.background} onChange={(e) => setId({ ...id, background: e.target.value })} />
            </Field>
            <Field label="Görünüş">
              <textarea className="input" rows={2} maxLength={1000} value={id.appearance} onChange={(e) => setId({ ...id, appearance: e.target.value })} />
            </Field>
            <div className="rounded-xl border border-accent/30 bg-accent/[0.05] p-4">
              <Field
                label="GM'e özel notlar ve gizli geçmiş"
                hint="Yalnızca sen ve GM görürsünüz. Sırlar, gizli bağlantılar, karakterin bilmediğin bir geçmişi, GM'den istediğin hikâye kancaları…"
              >
                <textarea className="input" rows={4} maxLength={6000} value={id.secretNotes} onChange={(e) => setId({ ...id, secretNotes: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-muted">Karakter portresini karakter oluşturduktan sonra karakter kağıdından ekleyebilirsin.</p>
          </Card>
        )}

        {cur === "ekspertiz" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Başlangıç ekspertiz ağacın, sembol stat&apos;ına <strong className="text-ink">+2</strong> verir ve ağacın kendi başlangıç bonusunu kazandırır. İkinci ağacı oyun içinde yetenek
              puanıyla açabilirsin.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {data.trees.map((t) => {
                const abs = t.abilities.map((k) => data.abilities[k]);
                const branches = [...new Map(abs.filter((a) => a.branch !== "Kök").map((a) => [a.branch, a])).values()];
                const root = abs.find((a) => a.branch === "Kök");
                const on = tree === t.key;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => chooseTree(t.key)}
                    aria-pressed={on}
                    className={cx("card relative flex flex-col gap-3 p-5 text-left transition", on ? "border-accent bg-accent/[0.08] ring-1 ring-accent/50" : "hover:border-accent/40")}
                  >
                    {on && (
                      <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-accent text-onAccent">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    <div className="flex items-center gap-4">
                      <TreeIcon treeKey={t.key} className="h-14 w-14" />
                      <div>
                        <p className="flex items-center gap-2 font-serif text-xl text-ink">
                          {t.name}
                          <TipButton kind="trees" id={t.key} title={t.name} />
                        </p>
                        <Meaning kind="trees" id={t.key} className="block" />
                        <p className="text-xs text-muted">
                          Ağaç stat&apos;ı: <span className="text-accent">{STAT_LABELS[t.stat]}</span> (+2)
                        </p>
                      </div>
                    </div>
                    <p className="rounded-lg bg-surface2/60 px-3 py-2 text-sm text-ink/90">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted">İlk ağaç bonusu</span>
                      {t.startBonusText.replace(/^.*?açılırsa\s*/i, "").replace(/oyuncu oyuna/i, "Oyuna")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {root && <span className="chip">Kök · {root.name}</span>}
                      {branches.map((b) => (
                        <span key={b.branch} className="chip">
                          {branchLabel(b)}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            {needsAug && T && (
              <p className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
                <strong>{T.name}</strong> ilk ağaç olarak seçildi: oyuna bir <strong>{(T.startBonus as { tier: string }).tier}</strong> augment ile başlarsın. Augment&apos;ini perklerden sonraki{" "}
                <strong>Augment</strong> adımında seçeceksin.
              </p>
            )}
          </div>
        )}

        {cur === "perkler" && (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
              <span>
                Başlangıç <strong className="font-mono">+{budget.start}</strong>
              </span>
              <span>
                Negatiflerden <strong className="font-mono text-ok">+{budget.gained}</strong>
              </span>
              <span>
                Pozitiflere <strong className="font-mono text-danger">−{budget.spent}</strong>
              </span>
              <span className={cx("ml-auto rounded-md px-2 py-1 font-mono", budget.left < 0 ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent")}>Kalan {budget.left}</span>
              <span className="w-full text-xs text-muted">
                Toplam puan negatife düşmeden istediğin kadar perk alabilirsin. Kalan puan (Puan + 1) / 2 olarak stat puanına dönüşür: şu an <strong className="text-ink">{budget.convertible}</strong>{" "}
                stat puanı.
              </span>
            </Card>
            {perks.includes(KV) && (
              <Card className="flex flex-col gap-5 border-danger/40 p-5 sm:flex-row">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="kicker text-danger">Kriegsversehrt · kopuk uzuv</p>
                    <p className="mt-1 text-sm text-ink/90">
                      Kopuk başlayacak 1 ya da 2 uzuv seç. Kol seçersen o koldaki el, bacak seçersen o bacaktaki ayak da kopar. Baş, boyun ve gövde seçilemez.
                    </p>
                    <p className="mt-1 text-sm">
                      Tek uzuv <strong className="font-mono text-ok">+{KRIEGSVERSEHRT.points[1]}</strong>, iki uzuv <strong className="font-mono text-ok">+{KRIEGSVERSEHRT.points[2]}</strong> perk puanı.
                      {ampPlan.roots.length > 0 && ampPlan.problems.length === 0 && (
                        <span className="ml-2 rounded bg-ok/15 px-1.5 py-0.5 font-mono text-ok">şu an +{KRIEGSVERSEHRT.points[ampPlan.roots.length]}</span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {AMPUTABLE_PARTS.map((k) => {
                      const on = amp.includes(k);
                      const parent = LIMB_PARENT[k];
                      const child = LIMB_CHILD[k];
                      const viaParent = !!parent && amp.includes(parent);
                      const dis = !on && (viaParent || (!!child && amp.includes(child)) || amp.length >= KRIEGSVERSEHRT.maxLimbs);
                      return (
                        <Button key={k} size="sm" variant={on ? "danger" : "secondary"} disabled={dis} onClick={() => toggleAmp(k)} aria-pressed={on}>
                          {bodyPartLabel(k)}
                          {child && <span className="text-[10px] opacity-75"> +{bodyPartLabel(child).split(" ")[1]}</span>}
                          {viaParent && <span className="text-[10px] opacity-75"> (kopuk)</span>}
                        </Button>
                      );
                    })}
                  </div>
                  {amp.length === 0 && <p className="text-xs text-warn">Devam etmek için en az bir uzuv seç.</p>}
                  {ampPlan.parts.length > 0 && <p className="text-xs text-muted">Kopuk başlayacak: {ampPlan.parts.map(bodyPartLabel).join(", ")}</p>}
                </div>
                <BodyDiagram body={result.body} className="mx-auto max-w-[140px] shrink-0" />
              </Card>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" className="inline-flex rounded-lg border border-line bg-surface p-1">
                {(
                  [
                    ["positive", `Pozitif (${data.perks.filter((p) => p.kind === "positive").length})`],
                    ["negative", `Negatif (${data.perks.filter((p) => p.kind === "negative").length})`],
                    ["selected", `Seçilenler (${perks.length})`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={perkTab === k}
                    onClick={() => setPerkTab(k)}
                    className={cx(
                      "rounded-md px-3 py-1.5 text-sm transition",
                      perkTab === k ? (k === "negative" ? "bg-danger/20 text-ink" : k === "positive" ? "bg-ok/20 text-ink" : "bg-accent/20 text-ink") : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input className="input max-w-xs flex-1" placeholder="Perk ara…" value={perkFilter} onChange={(e) => setPerkFilter(e.target.value)} />
            </div>
            <p className="text-xs text-muted">
              {perkTab === "positive" ? "Pozitif perkler perk puanı harcar." : perkTab === "negative" ? "Negatif perkler perk puanı kazandırır ama karakterine dezavantaj getirir." : "Seçtiğin perkler."}{" "}
              Turuncu etiketler birlikte alınamayan perkleri gösterir.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {visiblePerks.map((p) => {
                const on = perks.includes(p.key);
                const blockedBy = p.exclusive.find((x) => perks.includes(x));
                return (
                  <PerkCard
                    key={p.key}
                    perk={p}
                    selected={on}
                    disabled={!!blockedBy && !on}
                    blockedBy={blockedBy ? perkName.get(blockedBy) : null}
                    exclusiveNames={p.exclusive.map((x) => perkName.get(x) ?? x)}
                    pointsLabel={p.key === KV && on && ampPlan.roots.length && !ampPlan.problems.length ? String(KRIEGSVERSEHRT.points[ampPlan.roots.length]) : undefined}
                    action={
                      <Button
                        size="sm"
                        variant={on ? "primary" : "secondary"}
                        disabled={!!blockedBy && !on}
                        onClick={() => togglePerk(p.key)}
                        title={blockedBy ? `${perkName.get(blockedBy)} ile birlikte alınamaz` : undefined}
                      >
                        {on ? "Seçildi" : blockedBy ? <Lock className="h-3.5 w-3.5" /> : "Seç"}
                      </Button>
                    }
                  />
                );
              })}
              {!visiblePerks.length && <p className="text-sm text-muted">Gösterilecek perk yok.</p>}
            </div>
          </div>
        )}

        {cur === "augment" && T && needsAug && (
          <div className="space-y-4">
            <Card className="flex flex-col gap-5 p-5 sm:flex-row">
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p className="kicker">Başlangıç augment&apos;i · {(T.startBonus as { tier: string }).tier}</p>
                <p className="text-ink/90">
                  {T.name} ilk ağacın olduğu için oyuna bir augment takılı başlarsın. Bir augment ve takılacağı uzvu seç. Augment&apos;in stat etkileri statlara hemen yansır.
                </p>
                {perks.includes(KV) && amp.length > 0 && (
                  <p className="text-warn">
                    Kopuk uzvuna (ör. kopan ayağa Federfuß) augment takarsan protez olarak çalışır ve o uzuv sağlam sayılır. Kopuk bir kolun eline ya da kopuk bir bacağın ayağına augment takılamaz.
                  </p>
                )}
                {aug && (
                  <p>
                    Seçilen: <strong className="text-accent">{data.augments.find((a) => a.key === aug.key)?.name}</strong> · {bodyPartLabel(aug.part)}
                  </p>
                )}
                {augProblem && <p className="text-danger">{augProblem}</p>}
              </div>
              <BodyDiagram body={result.body} selected={(aug?.part as BodyPartKey) ?? null} className="mx-auto max-w-[150px] shrink-0" />
            </Card>
            <div className="grid gap-3 md:grid-cols-2">
              {data.augments
                .filter((a) => a.tier === (T.startBonus as { tier: string }).tier)
                .map((a) => (
                  <AugmentCard
                    key={a.key}
                    augment={a}
                    action={
                      <div className="flex flex-wrap gap-1.5">
                        {a.slots.map((sl) => {
                          const parent = LIMB_PARENT[sl];
                          const blocked = perks.includes(KV) && !!parent && amp.includes(parent);
                          const lost = perks.includes(KV) && ampPlan.parts.includes(sl);
                          return (
                            <Button
                              key={sl}
                              size="sm"
                              disabled={blocked}
                              title={blocked ? `${bodyPartLabel(parent!)} kopuk` : undefined}
                              variant={aug?.key === a.key && aug.part === sl ? "primary" : "secondary"}
                              onClick={() => setAug({ key: a.key, part: sl })}
                            >
                              {bodyPartLabel(sl)}
                              {lost && !blocked && " (protez)"}
                            </Button>
                          );
                        })}
                      </div>
                    }
                  />
                ))}
            </div>
          </div>
        )}

        {cur === "statlar" && (
          <Card className="p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface2/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted">Varsayılan</p>
                <p className="font-mono text-xl">{START_FREE_STATS}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface2/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted">Perklerden</p>
                <p className="font-mono text-xl">{budget.convertible}</p>
              </div>
              <div className={cx("rounded-lg border px-3 py-2", used === totalPoints ? "border-ok/50 bg-ok/10" : "border-accent/50 bg-accent/10")}>
                <p className="text-[10px] uppercase tracking-wider text-muted">Kalan</p>
                <p className="font-mono text-xl">
                  {totalPoints - used} / {totalPoints}
                </p>
              </div>
            </div>
            <p className="mb-4 text-sm text-muted">
              Puanları istediğin statlara dağıt. Ağaç stat&apos;ın ({T ? STAT_LABELS[T.stat] : "—"}) zaten +2 aldığı için ona en fazla perklerden gelen puan kadar ({treeCap}) ekleyebilirsin. Klang
              herkese +2 başlar.
            </p>
            <div className="divide-y divide-line">
              {STAT_KEYS.map((k) => {
                const isTree = T?.stat === k;
                const v = points[k] ?? 0;
                const canInc = used < totalPoints && result.stats[k] < STAT_MAX && (!isTree || v < treeCap);
                return (
                  <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5">
                    <div>
                      <span className="text-ink">{STAT_LABELS[k]}</span>
                      {isTree && (
                        <Badge tone="accent" className="ml-2">
                          Ağaç
                        </Badge>
                      )}
                      <span className="block text-xs text-muted">{STAT_HINTS[k]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink disabled:opacity-30" disabled={v <= 0} onClick={() => setPoints((f) => ({ ...f, [k]: v - 1 }))} aria-label={`${STAT_LABELS[k]} azalt`}>
                        −
                      </button>
                      <span className={cx("w-7 text-center font-mono text-sm", v > 0 ? "text-accent" : "text-muted")}>{v > 0 ? `+${v}` : 0}</span>
                      <button type="button" className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink disabled:opacity-30" disabled={!canInc} onClick={() => setPoints((f) => ({ ...f, [k]: v + 1 }))} aria-label={`${STAT_LABELS[k]} artır`}>
                        +
                      </button>
                    </div>
                    <span className="w-24 text-right">
                      <span className={cx("font-mono text-lg", eff[k].value < 0 ? "text-danger" : "text-ink")}>{eff[k].value}</span>
                      {eff[k].parts.length > 0 && (
                        <span className="block text-[10px] leading-tight text-muted">
                          taban {eff[k].base}
                          {eff[k].parts.map((p) => (
                            <span key={p.label} className={p.value > 0 ? "text-ok" : "text-danger"}>
                              {" "}
                              {p.value > 0 ? "+" : "−"}
                              {Math.abs(p.value)} {p.label}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {cur === "yetenek" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Seviye 0&apos;da 1 yetenek puanın var. Şartlarını karşıladığın bir yeteneği şimdi alabilir ya da puanı saklayıp oyun içinde harcayabilirsin.</p>
            <Button variant={first === null ? "primary" : "secondary"} onClick={() => setFirst(null)}>
              Şimdi seçme, puanı sakla
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              {T?.abilities.map((k) => {
                const a = data.abilities[k];
                const st = learnState(charForAbilities, k, data);
                const ok = st.state === "available";
                return (
                  <AbilityCard
                    key={k}
                    ability={a}
                    compact={!ok}
                    highlight={first === k ? "owned" : ok ? "available" : "locked"}
                    prereqName={a.prerequisite ? data.abilities[a.prerequisite]?.name : null}
                    footer={
                      ok ? (
                        <Button size="sm" variant={first === k ? "primary" : "outline"} onClick={() => setFirst(k)}>
                          {first === k ? "Seçildi" : "Bunu al"}
                        </Button>
                      ) : (
                        <p className="text-xs text-muted">Kilitli: {st.state === "locked" ? st.problems.join(" · ") : ""}</p>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {cur === "ozet" && (
          <Card className="space-y-5 p-6">
            <div>
              <p className="kicker mb-1">Kimlik</p>
              <p className="font-serif text-2xl">{id.name || "—"}</p>
              <p className="text-sm text-muted">
                {id.age} yaş · {id.nationality} · {id.alignment}
              </p>
            </div>
            <div className="flex items-start gap-3">
              {T && <TreeIcon treeKey={T.key} />}
              <div>
                <p className="kicker mb-1">Ekspertiz</p>
                <p>
                  {T?.name} <span className="text-muted">({T && STAT_LABELS[T.stat]})</span>
                  {aug && ` · Augment: ${data.augments.find((a) => a.key === aug.key)?.name} (${bodyPartLabel(aug.part)})`}
                </p>
                {T && <Html html={T.introHtml} className="mt-1 text-sm text-muted" />}
              </div>
            </div>
            <div>
              <p className="kicker mb-1">Perkler</p>
              <p className="text-sm">{perks.map((k) => perkName.get(k)).join(", ") || "Yok"}</p>
              {perks.includes(KV) && ampPlan.parts.length > 0 && <p className="mt-1 text-sm text-danger">Kopuk: {ampPlan.parts.map(bodyPartLabel).join(", ")}</p>}
            </div>
            <div>
              <p className="kicker mb-1">İlk yetenek</p>
              <p className="text-sm">{first ? data.abilities[first].name : "Seçilmedi (1 yetenek puanı saklanacak)"}</p>
            </div>
            {!result.ok && (
              <ul className="list-disc space-y-1 rounded-lg border border-danger/40 bg-danger/10 py-3 pl-8 pr-4 text-sm text-danger">
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <Button
              variant="primary"
              size="lg"
              disabled={!result.ok || !idOk || busy}
              onClick={async () => {
                const r = await run(() =>
                  api<{ id: string }>("/api/characters", {
                    body: { campaignId, ...id, creation: { tree, points, perks, startAugment: aug, firstAbility: first, amputation: perks.includes(KV) ? amp : null } },
                  }),
                );
                if (r) router.push(`/karakter/${r.id}`);
              }}
            >
              Karakteri onaya gönder
            </Button>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            ← Geri
          </Button>
          {step < STEPS.length - 1 && (
            <Button variant="primary" disabled={!stepOk[step]} onClick={() => setStep((s) => s + 1)}>
              İleri →
            </Button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <p className="kicker mb-3">Özet</p>
          <div className="flex items-center gap-3">
            {T && <TreeIcon treeKey={T.key} className="h-10 w-10" />}
            <div className="min-w-0">
              <p className="truncate font-serif text-lg">{id.name || "İsimsiz"}</p>
              <p className="text-xs text-muted">
                Seviye 0 · {T?.name ?? "ağaç seçilmedi"} · Corruption {result.corruption}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {STAT_KEYS.map((k) => (
              <div key={k} className="flex justify-between border-b border-line/50 py-1">
                <span className={cx(T?.stat === k ? "text-accent" : "text-muted")}>{STAT_LABELS[k]}</span>
                <span className={cx("font-mono", eff[k].value < 0 && "text-danger", eff[k].parts.length > 0 && eff[k].value > eff[k].base && "text-ok")}>{eff[k].value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm">
            <span className="text-muted">Perk puanı: </span>
            <span className={cx("font-mono", budget.left < 0 && "text-danger")}>{budget.left}</span>
            <span className="text-muted"> → stat: </span>
            <span className="font-mono">{budget.convertible}</span>
          </div>
          {result.problems.length > 0 && step > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-warn">
              {result.problems.slice(0, 5).map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  );
}
