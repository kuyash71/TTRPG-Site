"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseGamesetConfig } from "@/types/gameset-config";
import { WizardStepRace } from "./wizard-step-race";
import { WizardStepClass } from "./wizard-step-class";
import { WizardStepSkills } from "./wizard-step-skills";
import { WizardStepDetails } from "./wizard-step-details";
import { WizardStepSummary } from "./wizard-step-summary";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";

export interface WizardRace {
  id: string;
  name: string;
  description: string;
  racialTraits: { name: string; description: string }[];
}

export interface WizardClass {
  id: string;
  name: string;
  description: string;
  hitDie: number;
}

export interface WizardStatGroup {
  id: string;
  name: string;
  definitions: {
    id: string;
    key: string;
    label: string;
    type: string;
    formula: unknown;
    isPublic: boolean;
    maxVal: number | null;
  }[];
}

export interface CustomField {
  id: string;
  title: string;
  content: string;
  isPrivate: boolean;
}

export interface WizardDraft {
  raceId: string | null;
  classId: string | null;
  skillAllocations: Record<string, number>;
  name: string;
  backstory: string;
  customFields: CustomField[];
}

const STEPS = [
  { key: "race", label: "Irk" },
  { key: "class", label: "Sınıf" },
  { key: "skills", label: "Yetenekler" },
  { key: "details", label: "Detaylar" },
  { key: "summary", label: "Özet" },
] as const;

interface Props {
  sessionId: string;
  sessionName: string;
  gamesetConfig: Record<string, unknown>;
  classes: WizardClass[];
  races: WizardRace[];
  statGroups: WizardStatGroup[];
  skillTreeNodes: DbSkillTreeNode[];
  pendingRequest: { id: string; status: string } | null;
}

export function CharacterWizard({
  sessionId,
  sessionName,
  gamesetConfig,
  classes,
  races,
  statGroups,
  skillTreeNodes,
  pendingRequest,
}: Props) {
  const router = useRouter();
  const config = parseGamesetConfig(gamesetConfig);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<WizardDraft>(() => {
    // localStorage'dan taslak yükle
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`wizard-draft-${sessionId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return {
      raceId: null,
      classId: null,
      skillAllocations: {},
      name: "",
      backstory: "",
      customFields: [],
    };
  });

  function updateDraft(updates: Partial<WizardDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== "undefined") {
        localStorage.setItem(`wizard-draft-${sessionId}`, JSON.stringify(next));
      }
      return next;
    });
  }

  // Bekleyen istek varsa
  if (pendingRequest) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-void p-6">
        <div className="max-w-md rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="heading-gothic mb-3 text-lg font-semibold text-gold-400">
            Onay Bekleniyor
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Karakter oluşturma isteğiniz GM onayı bekliyor. GM onayladığında karakteriniz oluşturulacak.
          </p>
          <Link
            href={`/session/${sessionId}`}
            className="text-sm text-lavender-400 hover:underline"
          >
            Odaya Don
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/sessions/${sessionId}/character-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        raceId: draft.raceId,
        classId: draft.classId,
        skillAllocations: draft.skillAllocations,
        backstory: draft.backstory,
        customFields: draft.customFields,
      }),
    });

    if (res.ok) {
      localStorage.removeItem(`wizard-draft-${sessionId}`);
      router.push(`/session/${sessionId}`);
    } else {
      const data = await res.json();
      setError(data.error || "Bir hata oluştu.");
      setSubmitting(false);
    }
  }

  const canNext = () => {
    switch (step) {
      case 0: return !!draft.raceId;
      case 1: return !!draft.classId;
      case 2: return true;
      case 3: return !!draft.name.trim();
      default: return true;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-void">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href={`/session/${sessionId}`}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; {sessionName}
          </Link>
          <h1 className="heading-gothic text-base font-semibold text-zinc-100">
            Karakter Oluştur
          </h1>
        </div>
      </header>

      {/* Step indicator */}
      <div className="flex border-b border-border bg-surface-raised px-4">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i <= step && setStep(i)}
            disabled={i > step}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              step === i
                ? "border-b-2 border-gold-400 text-gold-400"
                : i < step
                  ? "text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === 0 && (
          <WizardStepRace
            races={races}
            selectedRaceId={draft.raceId}
            onSelect={(raceId) => updateDraft({ raceId })}
          />
        )}
        {step === 1 && (
          <WizardStepClass
            classes={classes}
            selectedClassId={draft.classId}
            onSelect={(classId) => updateDraft({ classId, skillAllocations: {} })}
          />
        )}
        {step === 2 && (
          <WizardStepSkills
            classId={draft.classId}
            skillTreeNodes={skillTreeNodes}
            skillAllocations={draft.skillAllocations}
            maxPoints={config.startingSkillPoints}
            statGroups={statGroups}
            onChange={(skillAllocations) => updateDraft({ skillAllocations })}
          />
        )}
        {step === 3 && (
          <WizardStepDetails
            name={draft.name}
            backstory={draft.backstory}
            customFields={draft.customFields}
            onChange={(updates) => updateDraft(updates)}
          />
        )}
        {step === 4 && (
          <WizardStepSummary
            draft={draft}
            races={races}
            classes={classes}
            skillTreeNodes={skillTreeNodes}
            statGroups={statGroups}
            config={config}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border bg-surface px-6 py-3">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md bg-surface-raised px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
        >
          Geri
        </button>

        {error && <span className="text-sm text-red-400">{error}</span>}

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canNext()}
            className="rounded-md bg-gold-600 px-6 py-2 text-sm font-medium text-void hover:bg-gold-500 disabled:opacity-50"
          >
            İleri
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !draft.name.trim()}
            className="rounded-md bg-gold-400 px-6 py-2 text-sm font-medium text-void hover:bg-gold-500 disabled:opacity-50"
          >
            {submitting ? "Gönderiliyor..." : "GM Onayına Gönder"}
          </button>
        )}
      </div>
    </div>
  );
}
