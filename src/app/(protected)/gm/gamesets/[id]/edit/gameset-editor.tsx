"use client";

import { useState } from "react";
import Link from "next/link";
import { GeneralTab } from "./general-tab";
import { StatDefinitionsTab } from "./stat-definitions-tab";
import { ClassRaceTab } from "./class-race-tab";
import { SkillTreeTab } from "./skill-tree-tab";
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

export interface GamesetData {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  statGroups: StatGroupData[];
  classes: ClassData[];
  races: RaceData[];
  skillTreeNodes: DbSkillTreeNode[];
}

// ─── Tabs ───────────────────────────────────────────────

const TABS = [
  { key: "general", label: "Genel" },
  { key: "stats", label: "Stat Tanımları" },
  { key: "class-race", label: "Sınıf & Irk" },
  { key: "skill-tree", label: "Skill Ağacı" },
  { key: "spells", label: "Büyüler" },
  { key: "items", label: "Eşyalar" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Component ──────────────────────────────────────────

export function GamesetEditor({ gameset }: { gameset: GamesetData }) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [data, setData] = useState<GamesetData>(gameset);

  return (
    <div className="flex h-screen flex-col bg-void">
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
            Gameset Editörü
          </span>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-border bg-surface-raised px-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-gold-400 text-gold-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
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
          />
        )}
        {activeTab === "spells" && (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            Büyü sistemi Sprint 7&apos;de eklenecek.
          </div>
        )}
        {activeTab === "items" && (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            Eşya sistemi Sprint 6&apos;da eklenecek.
          </div>
        )}
      </div>
    </div>
  );
}
