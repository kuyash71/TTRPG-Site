"use client";
import { Check, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { LanguagePicker } from "@/components/character/languages";
import { useAction } from "@/components/interactive";
import { Badge, Button, Card, Field, cx } from "@/components/ui";
import { StatBadge, UcAbilityCard, UcHtml, UcPerkCard } from "@/components/uc/cards";
import { UcClassIcon, UcDalIcon } from "@/components/uc/icons";
import { api } from "@/lib/client";
import { UC_LANGUAGES, languageProblems, languageSlots } from "@/lib/languages";
import { AGE_MAX, AGE_MIN } from "@/lib/shz/constants";
import { UC_STAT_KEYS, UC_STAT_LABELS } from "@/lib/uc/constants";
import type { UcAbility, UcPerk } from "@/lib/uc/content-types";
import { UC_START_FREE, UC_START_SYMBOL, UC_STAT_MAX, ucBuildCreation, ucDalStartBonus, ucLearnState, type UcRules } from "@/lib/uc/rules";
import { ucTipFor } from "@/lib/uc/tips";

const STEP_LABELS = { kimlik: "Kozmetik", sinif: "Ana sınıf", dal: "K1 dalı", perkler: "Perkler", diller: "Diller", statlar: "Statlar", yetenek: "İlk yetenek", ozet: "Özet" } as const;
type StepKey = keyof typeof STEP_LABELS;
const STEPS: StepKey[] = ["kimlik", "sinif", "dal", "perkler", "diller", "statlar", "yetenek", "ozet"];
const RACES = ["İnsan", "Elf (Silverarrow)", "Cüce (Ironsmith)"];

interface Identity {
  name: string;
  age: number;
  race: string;
  house: string;
  faith: string;
  food: string;
  background: string;
  appearance: string;
  secretNotes: string;
}

export function UcWizard({
  campaignId,
  startPerkPoints,
  data,
  classes,
  perks: perkList,
  abilities: abilityList,
}: {
  campaignId: string;
  startPerkPoints: number;
  data: UcRules;
  classes: { key: string; name: string; introHtml: string }[];
  perks: UcPerk[];
  abilities: UcAbility[];
}) {
  const { busy, run } = useAction();
  const [cur, setCur] = useState<StepKey>("kimlik");
  const [id, setId] = useState<Identity>({ name: "", age: 25, race: "İnsan", house: "", faith: "", food: "", background: "", appearance: "", secretNotes: "" });
  const [cls, setCls] = useState("");
  const [dal, setDal] = useState("");
  const [perks, setPerks] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [points, setPoints] = useState<Partial<Record<string, number>>>({});
  const [first, setFirst] = useState<string | null>(null);
  const [perkTab, setPerkTab] = useState<"positive" | "negative" | "selected">("positive");
  const [perkFilter, setPerkFilter] = useState("");

  const result = useMemo(() => ucBuildCreation({ classKey: cls, dal, points, perks, firstAbility: first }, startPerkPoints, data), [cls, dal, points, perks, first, startPerkPoints, data]);
  const budget = result.budget;
  const D = data.dals[dal];
  const totalPoints = UC_START_FREE + budget.convertible;
  const used = Object.values(points).reduce((a: number, b) => a + (b ?? 0), 0);
  const langSlots = languageSlots("UC", perks);
  const langProblems = languageProblems("UC", perks, langs);
  const perkName = useMemo(() => new Map(perkList.map((p) => [p.key, p.name])), [perkList]);

  const idOk = id.name.trim().length >= 2 && id.race.trim().length >= 2 && id.house.trim().length >= 2 && id.age >= AGE_MIN && id.age <= AGE_MAX;
  const faithOk = cls !== "priest" || id.faith.trim().length >= 2;
  const okMap: Record<StepKey, boolean> = {
    kimlik: idOk,
    sinif: !!cls && faithOk,
    dal: !!D && D.classKey === cls,
    perkler: budget.problems.length === 0,
    diller: langProblems.length === 0,
    statlar: used === totalPoints && (!D || (points[D.stat] ?? 0) <= budget.convertible),
    yetenek: true,
    ozet: result.ok && idOk && faithOk && langProblems.length === 0,
  };
  const stepOk = STEPS.map((k) => okMap[k]);
  const step = STEPS.indexOf(cur);
  const setStep = (v: number) => setCur(STEPS[Math.min(STEPS.length - 1, Math.max(0, v))]);

  const togglePerk = (k: string) => {
    const next = perks.includes(k) ? perks.filter((x) => x !== k) : [...perks, k];
    setPerks(next);
    setLangs((l) => l.slice(0, languageSlots("UC", next)));
    setPoints({});
    setFirst(null);
  };
  const q = perkFilter.toLocaleLowerCase("tr-TR");
  const visiblePerks = perkList.filter((p) => (perkTab === "selected" ? perks.includes(p.key) : p.kind === perkTab) && (!q || p.searchText.includes(q)));
  const charLike = { level: 0, stats: result.stats, trees: D ? [D.key] : [], abilities: {}, perks, body: {}, corruption: 0, inspiration: 0, uc: { classKey: cls } };

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
              <Field label="Karakter adı" hint="Hanesine ve bölgesine uygun bir isim (Leit'ateirr, Xitochi, Realm of Sand gelenekleri)">
                <input className="input" name="name" value={id.name} maxLength={60} onChange={(e) => setId({ ...id, name: e.target.value })} />
              </Field>
              <Field label="Yaş" hint={`${AGE_MIN}–${AGE_MAX} arası; elf ve cüceler için GM ile belirlenir`}>
                <input type="number" min={AGE_MIN} max={AGE_MAX} className="input" value={id.age} onChange={(e) => setId({ ...id, age: Number(e.target.value) })} />
              </Field>
              <Field label="Irk" hint="Mekanik etkisi yok; dünyanın sana nasıl davrandığını belirler">
                <input className="input" name="race" list="uc-races" value={id.race} maxLength={60} onChange={(e) => setId({ ...id, race: e.target.value })} />
                <datalist id="uc-races">
                  {RACES.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Hane ve ünvan" hint="Bağlı olduğun hane, ordu birliği ya da kurum">
                <input className="input" name="house" value={id.house} maxLength={80} placeholder="ör. Sanders'a bağlı Velites şövalyesi" onChange={(e) => setId({ ...id, house: e.target.value })} />
              </Field>
              <Field label="İnanç" hint="Priest için zorunlu ve mekanik etkili; diğerleri için RP">
                <input className="input" name="faith" value={id.faith} maxLength={80} onChange={(e) => setId({ ...id, faith: e.target.value })} />
              </Field>
              <Field label="Yiyecek" hint="Yanında taşıdığın erzak">
                <input className="input" name="food" value={id.food} maxLength={120} onChange={(e) => setId({ ...id, food: e.target.value })} />
              </Field>
            </div>
            <Field label="Geçmiş" hint="Partideki herkesin bilebileceği hikâye">
              <textarea className="input" rows={5} maxLength={4000} value={id.background} onChange={(e) => setId({ ...id, background: e.target.value })} />
            </Field>
            <Field label="Görünüş">
              <textarea className="input" rows={2} maxLength={1000} value={id.appearance} onChange={(e) => setId({ ...id, appearance: e.target.value })} />
            </Field>
            <div className="rounded-xl border border-lav/30 bg-lav/[0.05] p-4">
              <Field label="GM'e özel notlar ve gizli geçmiş" hint="Yalnızca sen ve GM görürsünüz.">
                <textarea className="input" rows={3} maxLength={6000} value={id.secretNotes} onChange={(e) => setId({ ...id, secretNotes: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-muted">Lumre (para) ve envanteri karakter kağıdından girersin; portreyi de oradan eklersin.</p>
          </Card>
        )}

        {cur === "sinif" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Ana sınıf oyun boyunca değişmez. Her sınıfta 3 katman, her katmanda 2 dal vardır; her katmanda yalnızca birini seçersin.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {classes.map((c) => {
                const on = cls === c.key;
                const dals = data.classes.find((x) => x.key === c.key)?.dals ?? [];
                return (
                  <button
                    type="button"
                    key={c.key}
                    aria-pressed={on}
                    onClick={() => {
                      setCls(c.key);
                      if (data.dals[dal]?.classKey !== c.key) setDal("");
                      setPoints({});
                      setFirst(null);
                    }}
                    className={cx("card relative flex flex-col gap-3 p-5 text-left transition", on ? "border-accent bg-accent/[0.08] ring-1 ring-accent/50" : "hover:border-accent/40")}
                  >
                    {on && (
                      <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-accent text-onAccent">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    <div className="flex items-center gap-4">
                      <UcClassIcon classKey={c.key} className="h-14 w-14" />
                      <div>
                        <p className="font-serif text-xl text-ink">{c.name}</p>
                        <p className="text-xs italic text-muted">{ucTipFor("classes", c.key)?.meaning}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dals.map((k) => (
                        <span key={k} className="chip">
                          K{data.dals[k].tier} · {data.dals[k].name}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            {cls === "priest" && (
              <Card className="border-lav/40 p-4">
                <Field label="İnanç (Priest için zorunlu)" hint="Priest'in inancı mekanik etki taşır; ayrıntılar sınıf sayfasında.">
                  <input className="input" value={id.faith} maxLength={80} onChange={(e) => setId({ ...id, faith: e.target.value })} />
                </Field>
              </Card>
            )}
          </div>
        )}

        {cur === "dal" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              K1 dalın, sembol stat&apos;ına <strong className="text-ink">+{UC_START_SYMBOL}</strong> verir ve dalın başlangıç bonusunu kazandırır. K2 dalını Sv 5&apos;te, K3 dalını Sv 10&apos;da
              seçeceksin.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {(data.classes.find((x) => x.key === cls)?.dals ?? [])
                .map((k) => data.dals[k])
                .filter((d) => d.tier === 1)
                .map((d) => {
                  const on = dal === d.key;
                  const b = ucDalStartBonus(d);
                  return (
                    <button
                      type="button"
                      key={d.key}
                      aria-pressed={on}
                      onClick={() => {
                        setDal(d.key);
                        setPoints({});
                        setFirst(null);
                      }}
                      className={cx("card relative flex flex-col gap-3 p-5 text-left transition", on ? "border-accent bg-accent/[0.08] ring-1 ring-accent/50" : "hover:border-accent/40")}
                    >
                      {on && (
                        <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-accent text-onAccent">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <UcDalIcon dalKey={d.key} tier={1} className="h-12 w-12" />
                        <div className="min-w-0">
                          <p className="font-serif text-xl text-ink">{d.name}</p>
                          <p className="text-xs italic text-muted">{ucTipFor("dals", d.key)?.meaning}</p>
                        </div>
                        <span className="ml-auto">
                          <StatBadge stat={d.stat} />
                        </span>
                      </div>
                      {d.identity && <p className="text-sm text-ink/85">{d.identity}</p>}
                      <p className="rounded-lg bg-surface2/60 px-3 py-2 text-sm text-ink/90">
                        <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Başlangıç</span>
                        {UC_STAT_LABELS[d.stat]} +{UC_START_SYMBOL}
                        {b && ` · ${UC_STAT_LABELS[b.stat]} +${b.amount}`}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {d.abilities.map((k) => (
                          <span key={k} className={cx("chip", data.abilities[k]?.signature && "border-accent/50 text-accent")}>
                            {data.abilities[k]?.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
            </div>
            {!cls && <p className="text-sm text-warn">Önce ana sınıfı seç.</p>}
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
                Kalan puan (Puan + 1) / 2 olarak stat puanına dönüşür: şu an <strong className="text-ink">{budget.convertible}</strong> stat puanı. Öneri: bir Köken, bir Bağ ve bir zaaf seç.
              </span>
              {result.warnings.map((w) => (
                <span key={w} className="w-full rounded-md bg-warn/10 px-2 py-1 text-xs text-warn">
                  {w}
                </span>
              ))}
            </Card>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" className="inline-flex rounded-lg border border-line bg-surface p-1">
                {(
                  [
                    ["positive", `Pozitif (${perkList.filter((p) => p.kind === "positive").length})`],
                    ["negative", `Negatif (${perkList.filter((p) => p.kind === "negative").length})`],
                    ["selected", `Seçilenler (${perks.length})`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={perkTab === k}
                    onClick={() => setPerkTab(k)}
                    className={cx("rounded-md px-3 py-1.5 text-sm transition", perkTab === k ? (k === "negative" ? "bg-danger/20 text-ink" : k === "positive" ? "bg-ok/20 text-ink" : "bg-accent/20 text-ink") : "text-muted hover:text-ink")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input className="input max-w-xs flex-1" placeholder="Perk ara…" value={perkFilter} onChange={(e) => setPerkFilter(e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visiblePerks.map((p) => {
                const on = perks.includes(p.key);
                const blockedBy = p.exclusive.find((x) => perks.includes(x));
                return (
                  <UcPerkCard
                    key={p.key}
                    perk={p}
                    selected={on}
                    exclusiveNames={p.exclusive.map((x) => perkName.get(x) ?? x)}
                    action={
                      <Button
                        size="sm"
                        variant={on ? "primary" : "secondary"}
                        disabled={!!blockedBy && !on}
                        onClick={() => togglePerk(p.key)}
                        title={blockedBy ? `${perkName.get(blockedBy)} ile birlikte alınamaz` : undefined}
                        data-testid={`perk-${p.key}`}
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

        {cur === "diller" &&
          (UC_LANGUAGES.length ? (
            <LanguagePicker list={UC_LANGUAGES} slots={langSlots} value={langs} onChange={setLangs} />
          ) : (
            <div data-testid="uc-lang-wip">
            <Card className="space-y-2 p-6 text-sm">
              <p className="font-serif text-lg text-ink">Umbra Caelis dilleri yakında</p>
              <p className="text-ink/85">
                Dünyanın dilleri (Leit&apos;ateirr dili, Xitochi dili, Çöl dili, Elf ve Cüce dilleri, eski rün dili…) hâlâ yazılıyor. Liste eklendiğinde karakter oluştururken buradan
                seçeceksin.
              </p>
              <p className="text-muted">
                Şimdilik bu adımı geç: GM karakterinin bildiği dilleri karakter ayrıntılarından ekler. Perklerine göre başlangıç hakkın <strong className="text-ink">{langSlots} dil</strong>{" "}
                (Monolingual 1, Polyglot 3).
              </p>
            </Card>
            </div>
          ))}

        {cur === "statlar" && (
          <Card className="p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface2/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted">Serbest</p>
                <p className="font-mono text-xl">{UC_START_FREE}</p>
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
              Sembol stat&apos;ın ({D ? UC_STAT_LABELS[D.stat] : "—"}) zaten +{UC_START_SYMBOL} aldı; 2 serbest puan sembol stat dışındaki statlara gider. Sembol stat&apos;a yalnızca
              perklerden dönen puanlar ({budget.convertible}) eklenebilir. Statlar 0–{UC_STAT_MAX} arasındadır.
            </p>
            <div className="divide-y divide-line">
              {UC_STAT_KEYS.map((k) => {
                const isSym = D?.stat === k;
                const v = points[k] ?? 0;
                const canInc = used < totalPoints && result.stats[k] < UC_STAT_MAX && (!isSym || v < budget.convertible);
                return (
                  <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5">
                    <div>
                      <span className="text-ink">{UC_STAT_LABELS[k]}</span>
                      {isSym && (
                        <Badge tone="accent" className="ml-2">
                          Sembol
                        </Badge>
                      )}
                      <span className="block text-xs text-muted">{ucTipFor("stats", k)?.summary ?? ucTipFor("stats", k)?.meaning}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink disabled:opacity-30" disabled={v <= 0} onClick={() => setPoints((f) => ({ ...f, [k]: v - 1 }))} aria-label={`${UC_STAT_LABELS[k]} azalt`}>
                        −
                      </button>
                      <span className={cx("w-7 text-center font-mono text-sm", v > 0 ? "text-accent" : "text-muted")}>{v > 0 ? `+${v}` : 0}</span>
                      <button type="button" className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink disabled:opacity-30" disabled={!canInc} onClick={() => setPoints((f) => ({ ...f, [k]: v + 1 }))} aria-label={`${UC_STAT_LABELS[k]} artır`}>
                        +
                      </button>
                    </div>
                    <span className="w-10 text-right font-mono text-lg text-ink">{result.stats[k]}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {cur === "yetenek" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Seviye 0&apos;da K1 dalında 1 yetenek puanın var. Şartlarını karşıladığın bir yeteneği şimdi alabilir ya da puanı saklayıp oyunda harcayabilirsin.</p>
            <Button variant={first === null ? "primary" : "secondary"} onClick={() => setFirst(null)}>
              Şimdi seçme, puanı sakla
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              {abilityList
                .filter((a) => a.dalKey === dal)
                .map((a) => {
                  const st = ucLearnState(charLike, a.key, data);
                  const ok = st.state === "available";
                  return (
                    <UcAbilityCard
                      key={a.key}
                      ability={a}
                      highlight={first === a.key ? "owned" : ok ? "available" : "locked"}
                      footer={
                        ok ? (
                          <Button size="sm" variant={first === a.key ? "primary" : "outline"} onClick={() => setFirst(a.key)}>
                            {first === a.key ? "Seçildi" : "Bunu al"}
                          </Button>
                        ) : (
                          <p className="text-xs text-muted">Kilitli: {st.problems.join(" · ")}</p>
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
                {id.age} yaş · {id.race} · {id.house || "—"}
                {id.faith && ` · ${id.faith}`}
              </p>
            </div>
            <div className="flex items-start gap-3">
              {D && <UcDalIcon dalKey={D.key} tier={1} />}
              <div>
                <p className="kicker mb-1">Sınıf ve dal</p>
                <p>
                  {classes.find((c) => c.key === cls)?.name} · {D?.name} <span className="text-muted">({D && UC_STAT_LABELS[D.stat]})</span>
                </p>
                {cls && <UcHtml html={classes.find((c) => c.key === cls)?.introHtml ?? ""} className="mt-1 line-clamp-3 text-sm text-muted" />}
              </div>
            </div>
            <div>
              <p className="kicker mb-1">Perkler</p>
              <p className="text-sm">{perks.map((k) => perkName.get(k)).join(", ") || "Yok"}</p>
            </div>
            <div>
              <p className="kicker mb-1">Diller</p>
              <p className="text-sm">{langs.length ? langs.join(", ") : UC_LANGUAGES.length ? "Seçilmedi" : "GM ekleyecek (liste yazım aşamasında)"}</p>
            </div>
            <div>
              <p className="kicker mb-1">İlk yetenek</p>
              <p className="text-sm">{first ? data.abilities[first]?.name : "Seçilmedi (1 yetenek puanı saklanacak)"}</p>
            </div>
            {(!result.ok || !faithOk) && (
              <ul className="list-disc space-y-1 rounded-lg border border-danger/40 bg-danger/10 py-3 pl-8 pr-4 text-sm text-danger">
                {!faithOk && <li>Priest için inanç zorunlu</li>}
                {result.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <Button
              variant="primary"
              size="lg"
              disabled={!okMap.ozet || busy}
              data-testid="uc-submit"
              onClick={async () => {
                const r = await run(() =>
                  api<{ id: string }>("/api/uc/characters", {
                    body: {
                      campaignId,
                      name: id.name,
                      age: id.age,
                      race: id.race,
                      house: id.house,
                      faith: id.faith,
                      food: id.food,
                      background: id.background,
                      appearance: id.appearance,
                      secretNotes: id.secretNotes,
                      languages: langs,
                      creation: { classKey: cls, dal, points, perks, firstAbility: first },
                    },
                  }),
                );
                if (r) window.location.assign(`/umbracaelis/karakter/${r.id}`);
              }}
            >
              Karakteri onaya gönder
            </Button>
          </Card>
        )}

        <div className="mt-6 flex justify-between">
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>
            ← Geri
          </Button>
          {step < STEPS.length - 1 && (
            <Button variant="primary" disabled={!stepOk[step]} onClick={() => setStep(step + 1)}>
              İleri →
            </Button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <p className="kicker mb-3">Özet</p>
          <div className="flex items-center gap-3">
            {cls && <UcClassIcon classKey={cls} className="h-10 w-10" />}
            <div className="min-w-0">
              <p className="truncate font-serif text-lg">{id.name || "İsimsiz"}</p>
              <p className="text-xs text-muted">
                Seviye 0 · {classes.find((c) => c.key === cls)?.name ?? "sınıf seçilmedi"}
                {D && ` · ${D.name}`}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {UC_STAT_KEYS.map((k) => (
              <div key={k} className="flex justify-between border-b border-line/50 py-1">
                <span className={cx(D?.stat === k ? "text-accent" : "text-muted")}>{UC_STAT_LABELS[k]}</span>
                <span className="font-mono">{result.stats[k]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm">
            <span className="text-muted">Perk puanı: </span>
            <span className={cx("font-mono", budget.left < 0 && "text-danger")}>{budget.left}</span>
            <span className="text-muted"> → stat: </span>
            <span className="font-mono">{budget.convertible}</span>
            <span className="text-muted"> · Bonus tavanı </span>
            <span className="font-mono">+4</span>
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
