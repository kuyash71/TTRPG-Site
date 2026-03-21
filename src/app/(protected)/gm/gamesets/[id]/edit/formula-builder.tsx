"use client";

import { useState, useEffect } from "react";
import type { FormulaNode } from "@/lib/stat-engine";

interface Props {
  value: unknown;
  onChange: (formula: FormulaNode | null) => void;
  availableStats: string[];
}

const OPS = [
  { value: "add", label: "+" },
  { value: "subtract", label: "-" },
  { value: "multiply", label: "x" },
  { value: "divide", label: "/" },
  { value: "floor", label: "floor" },
  { value: "ceil", label: "ceil" },
  { value: "min", label: "min" },
  { value: "max", label: "max" },
] as const;

/**
 * Basit görsel formül oluşturucu.
 * JSON editörü + önizleme ile çalışır.
 * İleri aşamada tam görsel editöre dönüştürülebilir.
 */
export function FormulaBuilder({ value, onChange, availableStats }: Props) {
  const [mode, setMode] = useState<"simple" | "json">("simple");

  // Basit mod: "stat OP stat/const" formatında tek katmanlı formül
  const [simpleForm, setSimpleForm] = useState(() => parseSimple(value));
  const [jsonText, setJsonText] = useState(() =>
    value ? JSON.stringify(value, null, 2) : ""
  );
  const [jsonError, setJsonError] = useState("");

  // Simple formüldeki değişiklik → JSON güncelle
  useEffect(() => {
    if (mode !== "simple") return;
    const formula = buildSimpleFormula(simpleForm);
    if (formula) {
      onChange(formula);
      setJsonText(JSON.stringify(formula, null, 2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simpleForm, mode]);

  function handleJsonChange(text: string) {
    setJsonText(text);
    setJsonError("");
    if (!text.trim()) {
      onChange(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      onChange(parsed as FormulaNode);
    } catch {
      setJsonError("Geçersiz JSON");
    }
  }

  return (
    <div className="space-y-2">
      {/* Mod seçici */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={`rounded px-2 py-1 text-xs ${
            mode === "simple"
              ? "bg-lavender-900/50 text-lavender-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Basit
        </button>
        <button
          type="button"
          onClick={() => setMode("json")}
          className={`rounded px-2 py-1 text-xs ${
            mode === "json"
              ? "bg-lavender-900/50 text-lavender-400"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          JSON
        </button>
      </div>

      {mode === "simple" ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* Operand 1 */}
          <OperandInput
            value={simpleForm.left}
            onChange={(v) => setSimpleForm((f) => ({ ...f, left: v }))}
            stats={availableStats}
          />

          {/* Operator */}
          <select
            value={simpleForm.op}
            onChange={(e) =>
              setSimpleForm((f) => ({ ...f, op: e.target.value }))
            }
            className="rounded-md border border-border bg-void px-2 py-1.5 text-sm text-gold-400 focus:border-lavender-400 focus:outline-none"
          >
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Operand 2 */}
          <OperandInput
            value={simpleForm.right}
            onChange={(v) => setSimpleForm((f) => ({ ...f, right: v }))}
            stats={availableStats}
          />

          {/* Önizleme */}
          <span className="ml-2 text-xs text-zinc-500">
            = {formulaPreview(simpleForm)}
          </span>
        </div>
      ) : (
        <div>
          <textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-border bg-void px-3 py-2 font-mono text-xs text-zinc-100 focus:border-lavender-400 focus:outline-none"
            placeholder='{"type":"op","op":"add","operands":[{"type":"stat","key":"CON"},{"type":"const","value":10}]}'
          />
          {jsonError && (
            <p className="mt-1 text-xs text-red-400">{jsonError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────

interface Operand {
  kind: "stat" | "const";
  statKey: string;
  constValue: number;
}

interface SimpleFormula {
  left: Operand;
  op: string;
  right: Operand;
}

function defaultOperand(): Operand {
  return { kind: "stat", statKey: "", constValue: 0 };
}

function parseSimple(value: unknown): SimpleFormula {
  const formula = value as FormulaNode | null;
  if (!formula || !("type" in formula) || formula.type !== "op") {
    return { left: defaultOperand(), op: "add", right: defaultOperand() };
  }
  const left = parseOperand(formula.operands[0]);
  const right = parseOperand(formula.operands[1]);
  return { left, op: formula.op, right };
}

function parseOperand(node: FormulaNode | undefined): Operand {
  if (!node) return defaultOperand();
  if (node.type === "stat") return { kind: "stat", statKey: node.key, constValue: 0 };
  if (node.type === "const") return { kind: "const", statKey: "", constValue: node.value };
  return defaultOperand();
}

function buildSimpleFormula(form: SimpleFormula): FormulaNode | null {
  const left = operandToNode(form.left);
  const right = operandToNode(form.right);
  if (!left || !right) return null;
  return {
    type: "op",
    op: form.op as FormulaNode & { type: "op" } extends { op: infer O } ? O : never,
    operands: [left, right],
  } as FormulaNode;
}

function operandToNode(op: Operand): FormulaNode | null {
  if (op.kind === "stat" && op.statKey) return { type: "stat", key: op.statKey };
  if (op.kind === "const") return { type: "const", value: op.constValue };
  return null;
}

function formulaPreview(form: SimpleFormula): string {
  const l = form.left.kind === "stat" ? form.left.statKey || "?" : String(form.left.constValue);
  const r = form.right.kind === "stat" ? form.right.statKey || "?" : String(form.right.constValue);
  const opLabel = OPS.find((o) => o.value === form.op)?.label ?? form.op;
  return `${l} ${opLabel} ${r}`;
}

// ─── Operand Input ──────────────────────────────────────

function OperandInput({
  value,
  onChange,
  stats,
}: {
  value: Operand;
  onChange: (v: Operand) => void;
  stats: string[];
}) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={value.kind}
        onChange={(e) =>
          onChange({ ...value, kind: e.target.value as "stat" | "const" })
        }
        className="rounded border border-border bg-void px-1.5 py-1.5 text-xs text-zinc-400 focus:border-lavender-400 focus:outline-none"
      >
        <option value="stat">Stat</option>
        <option value="const">Sabit</option>
      </select>
      {value.kind === "stat" ? (
        <select
          value={value.statKey}
          onChange={(e) => onChange({ ...value, statKey: e.target.value })}
          className="rounded border border-border bg-void px-2 py-1.5 font-mono text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        >
          <option value="">Seçin...</option>
          {stats.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          value={value.constValue}
          onChange={(e) =>
            onChange({ ...value, constValue: Number(e.target.value) })
          }
          className="w-20 rounded border border-border bg-void px-2 py-1.5 font-mono text-sm text-zinc-100 focus:border-lavender-400 focus:outline-none"
        />
      )}
    </div>
  );
}
