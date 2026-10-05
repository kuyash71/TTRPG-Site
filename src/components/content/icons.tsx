import {
  Activity,
  Atom,
  Battery,
  BatteryCharging,
  Binoculars,
  Bomb,
  BookOpen,
  Bot,
  BrainCircuit,
  Cable,
  ChartColumn,
  CircleDot,
  Crown,
  Dna,
  Drama,
  Droplet,
  Ear,
  Fingerprint,
  Flag,
  Flame,
  FlaskConical,
  Gavel,
  Ghost,
  Grab,
  Hammer,
  Hand,
  HandHeart,
  HeartPulse,
  Hexagon,
  Infinity as InfinityIcon,
  KeyRound,
  Layers,
  Map as MapIcon,
  MessageSquareQuote,
  Microscope,
  Package,
  PersonStanding,
  Radar,
  Radio,
  Scan,
  ShieldHalf,
  ShieldPlus,
  Siren,
  Target,
  Truck,
  UserRound,
  Waves,
  BicepsFlexed,
  Bird,
  Bone,
  BookX,
  Box,
  Brain,
  Car,
  Church,
  Cigarette,
  Clover,
  Cog,
  Coins,
  Cpu,
  Cross,
  Crosshair,
  Droplets,
  Dumbbell,
  Eye,
  EyeOff,
  Feather,
  Footprints,
  Gauge,
  Glasses,
  HandCoins,
  Heart,
  HeartCrack,
  Languages,
  type LucideIcon,
  Magnet,
  MapPinned,
  Medal,
  Megaphone,
  MessageCircle,
  MessageCircleOff,
  MessagesSquare,
  Moon,
  Pill,
  Rabbit,
  Scale,
  ScanEye,
  ScrollText,
  Shield,
  Skull,
  Snowflake,
  Soup,
  Sparkles,
  Stamp,
  Sword,
  Swords,
  Syringe,
  Thermometer,
  Turtle,
  VenetianMask,
  Wind,
  Wine,
  Wrench,
  Zap,
} from "lucide-react";
import { SunLogo } from "../logo";
import { cx } from "../ui";

const PERK_ICONS: Record<string, LucideIcon> = {
  "careful-runner": Footprints,
  "one-hander": Sword,
  "speed-demon": Car,
  "two-hander": Swords,
  kench: Soup,
  bladesmith: Wrench,
  eisblut: Snowflake,
  falscher: Stamp,
  feldsanitater: Cross,
  katze: Eye,
  ortskundig: MapPinned,
  schwarzmarkt: HandCoins,
  trilingual: Languages,
  adlerauge: Crosshair,
  extrovert: MessageCircle,
  gluckspilz: Clover,
  heimwerker: Cog,
  runenkundig: ScrollText,
  schnell: Wind,
  tesla: Zap,
  cheetah: Rabbit,
  "follower-of-dreamer": Sparkles,
  metallvertraglich: Magnet,
  ruthig: VenetianMask,
  beherzt: Heart,
  "tdt-teich-der-toten": Droplets,
  adaptable: Thermometer,
  ubermuscler: Dumbbell,
  ubermensch: BicepsFlexed,
  "veteran-of-47": Medal,
  "sunday-driver": Turtle,
  tiryaki: Cigarette,
  analphabet: BookX,
  ayyas: Wine,
  empfi: Soup,
  kurzsichtig: Glasses,
  monolingual: MessageCircleOff,
  verschuldet: Coins,
  blutscheu: Droplets,
  ehrenkodex: Scale,
  gesucht: Crosshair,
  klaustrophob: Box,
  oaf: Footprints,
  okkultphobie: Skull,
  schlaflos: Moon,
  gottesfurchtig: Church,
  introvert: MessageCircleOff,
  kriegszitterer: Zap,
  laut: Megaphone,
  recovered: Pill,
  delicate: Feather,
  metallabstossung: Magnet,
  runenblind: EyeOff,
  "such-tiger": Syringe,
  unthermo: Thermometer,
  scheu: HeartCrack,
  kriegsversehrt: Bone,
  zargana: Feather,
  schizo: Brain,
  "pressured-pacifism": Bird,
};

export function PerkIcon({ perkKey, kind, className }: { perkKey: string; kind: "positive" | "negative"; className?: string }) {
  const I = PERK_ICONS[perkKey] ?? (kind === "positive" ? Shield : ScanEye);
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

const TREE_ICONS: Record<string, LucideIcon | "sun"> = {
  ubermann: Shield,
  stahlkrieg: Crosshair,
  spionage: VenetianMask,
  diplomat: MessagesSquare,
  wunderwaffe: Cog,
  schwarzesonne: "sun",
  metallkorp: Cpu,
};

export function TreeIcon({ treeKey, className }: { treeKey: string; className?: string }) {
  const I = TREE_ICONS[treeKey] ?? Gauge;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent", className ?? "h-12 w-12")} aria-hidden>
      {I === "sun" ? <SunLogo className="h-[62%] w-[62%]" /> : <I className="h-[55%] w-[55%]" strokeWidth={1.7} />}
    </span>
  );
}

// ------------------------------------------------------------------ yetenek, augment, stat, kural ikonları
const ABILITY_ICONS: Record<string, LucideIcon> = {
  kampfmedizin: HandHeart,
  "grosse-macht": Hammer,
  sturmbrecher: Zap,
  titan: Flame,
  wurgegriff: Grab,
  "herr-der-toten": Skull,
  "mein-liebe": HeartPulse,
  "endsieg-der-mann": InfinityIcon,
  kampfveteran: Medal,
  snipe: Crosshair,
  lauerstellung: Binoculars,
  "ein-schuss": Target,
  feuerleitung: Radar,
  zweihandler: Swords,
  panzerknacker: Bomb,
  "engel-des-todes": Ghost,
  "silent-step-low-profile": Footprints,
  "throwing-expertise": Sword,
  giftmischer: FlaskConical,
  "silent-takedown": Hand,
  dunkelhand: Fingerprint,
  "the-great-pretender": Drama,
  "der-maulwurf": VenetianMask,
  saboteur: Wrench,
  "geist-la-resistance": Flag,
  "authority-like-herr-a": Crown,
  volksredner: Megaphone,
  fahnentrager: Flag,
  "ihr-preis": Coins,
  "see-through-em": ScanEye,
  schlangenzunge: MessageSquareQuote,
  verhormeister: Gavel,
  kriegsengineer: Cog,
  maschinengehirn: BrainCircuit,
  sprengmeister: Bomb,
  "eiserner-kamerad": Bot,
  panzerschrauber: Truck,
  "knowledge-of-future": Atom,
  kriegssheilung: Syringe,
  "aryan-cryptology": KeyRound,
  "kluger-kopf": Brain,
  "siegel-der-leere": CircleDot,
  "siegel-der-verdamm": Stamp,
  "grosses-siegel": Hexagon,
  "extracio-aus-ss": ScrollText,
  totenruf: Waves,
  "toter-soldaten": PersonStanding,
  blutopfer: Droplet,
  stahlnerv: Activity,
  "zweite-haut": ShieldPlus,
  "kalte-seele": Snowflake,
  "neuer-mensch": Dna,
  ersatzteil: Package,
  uberladung: BatteryCharging,
  schnittstelle: Cable,
  kriegsmaschine: Siren,
};
const TYPE_STYLE: Record<string, string> = {
  Aktif: "border-accent/35 bg-accent/10 text-accent",
  Pasif: "border-line bg-surface2 text-ink/80",
  Tepki: "border-warn/40 bg-warn/10 text-warn",
};
export function AbilityIcon({ abilityKey, type, className }: { abilityKey: string; type: string; className?: string }) {
  const I = ABILITY_ICONS[abilityKey] ?? Sparkles;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border", TYPE_STYLE[type] ?? TYPE_STYLE.Pasif, className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}

const AUGMENT_ICONS: Record<string, LucideIcon> = {
  federfuss: Feather,
  funkohr: Radio,
  glasauge: Eye,
  laufwerk: Footprints,
  stahlfinger: Hand,
  akkutrager: Battery,
  klingenarm: Sword,
  panzerhaut: ShieldHalf,
  sturmarm: BicepsFlexed,
  geistauge: Scan,
  gletschkanon: Snowflake,
  "schwarzes-herz": HeartCrack,
};
const TIER_STYLE: Record<string, string> = {
  T1: "border-accent/35 bg-accent/10 text-accent",
  T2: "border-warn/40 bg-warn/10 text-warn",
  T3: "border-danger/40 bg-danger/10 text-danger",
};
export function AugmentIcon({ augmentKey, tier, className }: { augmentKey: string; tier: string; className?: string }) {
  const I = AUGMENT_ICONS[augmentKey] ?? Cpu;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border", TIER_STYLE[tier] ?? TIER_STYLE.T1, className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}

const STAT_ICONS: Record<string, LucideIcon> = {
  korp: Shield,
  krach: Hammer,
  klang: Cpu,
  sanita: Brain,
  rede: MessagesSquare,
  wissen: BookOpen,
  sicht: Eye,
  agil: Wind,
  werk: Wrench,
  leis: Footprints,
  aim: Crosshair,
};
export function StatIcon({ stat, className }: { stat: string; className?: string }) {
  const I = STAT_ICONS[stat] ?? Gauge;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent", className ?? "h-9 w-9")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}

const PAGE_ICONS: Record<string, LucideIcon> = {
  "temel-kurallar": BookOpen,
  karakter: UserRound,
  statlar: ChartColumn,
  "beden-ve-yaralar": HeartPulse,
  corruption: Skull,
  perkler: Sparkles,
  augmentler: Cpu,
  kampanyalar: MapIcon,
  sozluk: Languages,
  yetenekler: Layers,
  ara: Scan,
};
export function PageIcon({ page, className }: { page: string; className?: string }) {
  const I = PAGE_ICONS[page] ?? ScrollText;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent", className ?? "h-10 w-10")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}
/** Kenar menüsü gibi küçük yerler için yalnızca simge. */
export function PageGlyph({ page, className }: { page: string; className?: string }) {
  const I = PAGE_ICONS[page] ?? ScrollText;
  return <I className={className ?? "h-4 w-4"} strokeWidth={1.8} aria-hidden />;
}

const TERM_ICONS: Record<string, LucideIcon> = {
  corruption: Skull,
  cower: HeartCrack,
  frenzy: Flame,
  nat20: Sparkles,
  nat1: CircleDot,
  "death-save": HeartPulse,
  inspiration: Medal,
  pervitin: Pill,
  akku: Battery,
  gletschmetall: Snowflake,
  uber: Crown,
};
export function TermIcon({ term, className }: { term: string; className?: string }) {
  const I = TERM_ICONS[term] ?? ScrollText;
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-lg border border-warn/35 bg-warn/10 text-warn", className ?? "h-9 w-9")} aria-hidden>
      <I className="h-[55%] w-[55%]" strokeWidth={1.8} />
    </span>
  );
}
