import type { ReactNode } from "react";
import type { Ability, Tree } from "@/lib/shz/content-types";
import { cx } from "../ui";
import { Tr } from "./tr";

/**
 * Ekspertiz ağacının görsel düzeni:
 *  Kök yetenek(ler) üstte; altında iki ana kol (A, B) yan yana.
 *  Her kolda yetenekler öncül sırasıyla alt alta, aralarında bağlantı çizgisi.
 *  Yan dallar (A′, B′) öncüllerinin hemen altında, girintili ve kesik çizgili bir blokta.
 */
export function AbilityTree({
  tree,
  abilities,
  render,
  owned,
}: {
  tree: Tree;
  abilities: Record<string, Ability>;
  render: (a: Ability) => ReactNode;
  /** Sahip olunan yetenekler: bağlantı çizgileri vurgulanır. */
  owned?: Record<string, number>;
}) {
  const abs = tree.abilities.map((k) => abilities[k]).filter(Boolean);
  const roots = abs.filter((a) => a.branch === "Kök");
  const groups = (["A", "B"] as const)
    .map((L) => ({ L, list: abs.filter((a) => a.branch === L || a.branch === `${L}′`) }))
    .filter((g) => g.list.length);
  const other = abs.filter((a) => a.branch === "?");
  const has = (k: string | null) => !!k && (owned?.[k] ?? 0) > 0;

  const node = (a: Ability, group: Ability[], depth: number): ReactNode => {
    const kids = group.filter((x) => x.prerequisite === a.key);
    const main = kids.filter((x) => x.branch === a.branch);
    const side = kids.filter((x) => x.branch !== a.branch);
    return (
      <div key={a.key}>
        {render(a)}
        {side.map((sb) => (
          <div key={sb.key} className="mt-3 ml-4 sm:ml-6">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-warn">
              <span className="inline-block h-px w-4 bg-warn/60" aria-hidden />
              <Tr s="Yan dal {b}" vars={{ b: sb.branch }} /> · {sb.branchName}{" "}
              <span className="normal-case tracking-normal text-muted">
                <Tr s="({name} sonrası)" vars={{ name: a.name }} />
              </span>
            </p>
            <div className="border-l-2 border-dashed border-warn/50 pl-3 sm:pl-4">{node(sb, group, depth + 1)}</div>
          </div>
        ))}
        {main.map((m) => (
          <div key={m.key}>
            <Connector lit={has(a.key)} />
            {node(m, group, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {roots.length > 0 && (
        <div>
          <BranchHeader code={<Tr s="Kök" />} name={<Tr s="Ağacın temeli · öncülsüz" />} />
          <div className="grid gap-3 md:grid-cols-2">{roots.map((a) => render(a))}</div>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        {groups.map((g) => {
          const inGroup = new Set(g.list.map((a) => a.key));
          const starts = g.list.filter((a) => !a.prerequisite || !inGroup.has(a.prerequisite));
          const mainName = g.list.find((a) => a.branch === g.L)?.branchName ?? "";
          return (
            <section key={g.L} className="min-w-0">
              <BranchHeader code={<Tr s="Kol {l}" vars={{ l: g.L }} />} name={mainName} />
              <div className="space-y-4">{starts.map((a) => node(a, g.list, 0))}</div>
            </section>
          );
        })}
      </div>
      {other.length > 0 && (
        <div>
          <BranchHeader code={<Tr s="Diğer" />} name="" />
          <div className="grid gap-3 md:grid-cols-2">{other.map((a) => render(a))}</div>
        </div>
      )}
    </div>
  );
}

function BranchHeader({ code, name }: { code: ReactNode; name: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-accent">{code}</span>
      {name && <span className="font-serif text-lg text-ink">{name}</span>}
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );
}

function Connector({ lit }: { lit?: boolean }) {
  return (
    <div className="ml-6 flex h-7 items-center" aria-hidden>
      <span className={cx("relative h-full w-0.5", lit ? "bg-accent" : "bg-line")}>
        <span className={cx("absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2", lit ? "border-accent" : "border-line")} />
      </span>
    </div>
  );
}
