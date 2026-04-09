"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, TranslationKey } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { GeneralTab } from "./general-tab";
import { StatDefinitionsTab } from "./stat-definitions-tab";
import { ClassRaceTab } from "./class-race-tab";
import { SkillTreeTab } from "./skill-tree-tab";
import { ItemsTab } from "./items-tab";
import { SpellsTab } from "./spells-tab";
import type { DbSkillTreeNode } from "@/lib/skill-tree-utils";

// ─── Types ──────────────────────────────────────────────

export interface StatDefData {
  id: string;
  key: string;
  label: string;
  type: string;
  formula: unknown;
  isPublic: boolean;
  maxVal: number | null;
  sortOrder: number;
}

export interface StatGroupData {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  definitions: StatDefData[];
}

export interface SubclassData {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
}

export interface ClassData {
  id: string;
  name: string;
  description: string;
  hitDie: number;
  subclasses: SubclassData[];
}

export interface RaceData {
  id: string;
  name: string;
  description: string;
  racialTraits: { name: string; description: string }[];
}

export interface ItemDefinitionData {
  id: string;
  name: string;
  description: string;
  category: string;
  gridWidth: number;
  gridHeight: number;
  equipmentSlot: string | null;
  statBonuses: unknown;
  price: Record<string, number>;
  stackable: boolean;
  maxStack: number;
  rarity: string;
  iconUrl: string | null;
}

export interface SpellDefinitionData {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  cooldown: number;
  range: number;
  targetType: string;
  effects: unknown;
  iconUrl: string | null;
  requiredLevel: number;
}

export interface GamesetData {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  statGroups: StatGroupData[];
  classes: ClassData[];
  races: RaceData[];
  skillTreeNodes: DbSkillTreeNode[];
  itemDefinitions: ItemDefinitionData[];
  spellDefinitions: SpellDefinitionData[];
}

// ─── Tabs ───────────────────────────────────────────────

const TAB_KEYS = [
  { key: "general", label: "editor.tabGeneral" as TranslationKey },
  { key: "stats", label: "editor.tabStats" as TranslationKey },
  { key: "class-race", label: "editor.tabClassRace" as TranslationKey },
  { key: "skill-tree", label: "editor.tabSkillTree" as TranslationKey },
  { key: "spells", label: "editor.tabSpells" as TranslationKey },
  { key: "items", label: "editor.tabItems" as TranslationKey },
] as const;

type TabKey = (typeof TAB_KEYS)[number]["key"];

// ─── Component ──────────────────────────────────────────

export function GamesetEditor({ gameset }: { gameset: GamesetData }) {
  const { t } = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [data, setData] = useState<GamesetData>(gameset);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    window.open(`/api/gamesets/${data.id}/export`, "_blank");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch("/api/gamesets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });

      if (res.ok) {
        const result = await res.json();
        router.push(`/gm/gamesets/${result.id}/edit`);
      } else {
        const err = await res.json();
        alert(err.error || "Import başarısız.");
      }
    } catch {
      alert("Dosya okunamadı veya geçersiz JSON formatı.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex h-screen flex-col bg-void">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            &larr; Dashboard
          </Link>
          <h1 className="heading-gothic text-base font-semibold text-zinc-100">
            {data.name}
          </h1>
          <span className="rounded bg-gold-900/50 px-1.5 py-0.5 text-[10px] font-medium text-gold-400">
            {t("editor.badge")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          <LocaleSwitcher />
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-border bg-surface-raised px-4">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-gold-400 text-gold-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "general" && (
          <GeneralTab
            gamesetId={data.id}
            name={data.name}
            description={data.description}
            config={data.config}
            onUpdate={(updates) => setData((prev) => ({ ...prev, ...updates }))}
          />
        )}
        {activeTab === "stats" && (
          <StatDefinitionsTab
            gamesetId={data.id}
            statGroups={data.statGroups}
            onUpdate={(statGroups) =>
              setData((prev) => ({ ...prev, statGroups }))
            }
          />
        )}
        {activeTab === "class-race" && (
          <ClassRaceTab
            gamesetId={data.id}
            classes={data.classes}
            races={data.races}
            hpSystem={(data.config?.hpSystem as string) || "hit-die"}
            onUpdateClasses={(classes) =>
              setData((prev) => ({ ...prev, classes }))
            }
            onUpdateRaces={(races) =>
              setData((prev) => ({ ...prev, races }))
            }
          />
        )}
        {activeTab === "skill-tree" && (
          <SkillTreeTab
            gamesetId={data.id}
            skillTreeNodes={data.skillTreeNodes}
            classes={data.classes}
            statGroups={data.statGroups}
            spellDefinitions={data.spellDefinitions}
          />
        )}
        {activeTab === "spells" && (
          <SpellsTab
            gamesetId={data.id}
            spells={data.spellDefinitions}
            onUpdate={(spellDefinitions) =>
              setData((prev) => ({ ...prev, spellDefinitions }))
            }
          />
        )}
        {activeTab === "items" && (
          <ItemsTab
            gamesetId={data.id}
            items={data.itemDefinitions}
            statGroups={data.statGroups}
            config={data.config}
            onUpdate={(itemDefinitions) =>
              setData((prev) => ({ ...prev, itemDefinitions }))
            }
          />
        )}
      </div>
    </div>
  );
}
