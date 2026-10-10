import {
  Drama,
  BicepsFlexed,
  BookA,
  BookOpen,
  Brain,
  Church,
  Crosshair,
  Dices,
  Eye,
  Flame,
  Gem,
  Ghost,
  Hand,
  HeartPulse,
  House,
  Layers,
  Link2,
  MoonStar,
  PersonStanding,
  RefreshCcw,
  ScrollText,
  Search,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sword,
  Swords,
  UserRound,
  WandSparkles,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cx } from "../ui";

const CLASS_ICONS: Record<string, LucideIcon> = {
  "close-quarter": Swords,
  hunter: Crosshair,
  priest: Church,
  scholar: WandSparkles,
};
const DAL_ICONS: Record<string, LucideIcon> = {
  brute: BicepsFlexed,
  swordsman: Sword,
  arcanist: Flame,
  berserker: Zap,
  duelist: Swords,
  shinigami: Ghost,
  lurcher: Eye,
  ranger: Crosshair,
  artisan: Wrench,
  shade: MoonStar,
  slayer: Skull,
  stormer: Shield,
  prayer: HeartPulse,
  preacher: ScrollText,
  "men-of-will": UserRound,
  "will-of-god": Hand,
  archpriest: Church,
  occultist: Drama,
  runecaster: Gem,
  wizard: WandSparkles,
  shackled: Link2,
  unleashed: Zap,
  catastrophe: Flame,
  divine: Sparkles,
};
const TIER_TONE: Record<number, string> = {
  1: "border-accent/35 bg-accent/10 text-accent",
  2: "border-lav/40 bg-lav/10 text-lav",
  3: "border-accent/60 bg-gradient-to-br from-accent/25 to-lav/20 text-ink",
};

export function UcClassIcon({ classKey, className }: { classKey: string; className?: string }) {
  const I = CLASS_ICONS[classKey] ?? Layers;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-xl border border-accent/40 bg-gradient-to-br from-accent/15 to-lav/10 text-accent", className ?? "h-12 w-12")} aria-hidden>
      <I className="h-[52%] w-[52%]" strokeWidth={1.7} />
    </span>
  );
}

export function UcDalIcon({ dalKey, tier, className }: { dalKey: string; tier: number; className?: string }) {
  const I = DAL_ICONS[dalKey] ?? Layers;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border", TIER_TONE[tier] ?? TIER_TONE[1], className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}

const TYPE_ICONS: Record<string, LucideIcon> = { Aktif: Zap, Pasif: Shield, Tepki: RefreshCcw };
export function UcAbilityIcon({ type, signature, className }: { type: string; signature?: boolean; className?: string }) {
  const I = signature ? Star : (TYPE_ICONS[type] ?? Sparkles);
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-lg border",
        signature ? "border-accent/60 bg-accent/15 text-accent" : type === "Tepki" ? "border-lav/40 bg-lav/10 text-lav" : "border-line bg-surface2 text-accent",
        className ?? "h-10 w-10",
      )}
      aria-hidden
    >
      <I className="h-[50%] w-[50%]" strokeWidth={1.8} />
    </span>
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Köken: House,
  Bağ: Link2,
  Beden: BicepsFlexed,
  Zihin: Brain,
  Beceri: Wrench,
  Mana: Sparkles,
  Bağımlılık: Wine,
};
export function UcPerkIcon({ category, kind, className }: { category: string; kind: "positive" | "negative"; className?: string }) {
  const I = CATEGORY_ICONS[category] ?? Star;
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-lg border",
        kind === "positive" ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger",
        className ?? "h-10 w-10",
      )}
      aria-hidden
    >
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}
export function UcCategoryGlyph({ category, className }: { category: string; className?: string }) {
  const I = CATEGORY_ICONS[category] ?? Star;
  return <I className={className ?? "h-3.5 w-3.5"} strokeWidth={1.8} aria-hidden />;
}

const PAGE_ICONS: Record<string, LucideIcon> = {
  "temel-kurallar": Dices,
  karakter: UserRound,
  "beden-ve-yaralar": PersonStanding,
  mana: Sparkles,
  yozlasma: MoonStar,
  sozluk: BookA,
  perkler: Star,
  siniflar: Layers,
  ara: Search,
};
export function UcPageIcon({ page, className }: { page: string; className?: string }) {
  const I = PAGE_ICONS[page] ?? BookOpen;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent", className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}
export function UcPageGlyph({ page, className }: { page: string; className?: string }) {
  const I = PAGE_ICONS[page] ?? CLASS_ICONS[page] ?? BookOpen;
  return <I className={className ?? "h-4 w-4"} strokeWidth={1.8} aria-hidden />;
}
export function UcStatGlyph({ className }: { className?: string }) {
  return <Dices className={className ?? "h-4 w-4"} strokeWidth={1.8} aria-hidden />;
}
