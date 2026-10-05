import { Lightbulb } from "lucide-react";
import { tipFor, type TipKind } from "@/lib/shz/tips";
import { cx } from "../ui";

/**
 * Almanca bir adın yanına konan "ipucu" düğmesi. Tıklanınca TipLayer açıklama balonunu gösterir.
 * Sunucu bileşenlerinde de kullanılabilir: davranış tamamen data-* öznitelikleriyle TipLayer'dadır.
 * Bir <button> ya da <a> içinde kalabileceği için kendisi <span role="button"> olarak çizilir.
 */
export function TipButton({ kind, id, title, className }: { kind: TipKind; id: string; title: string; className?: string }) {
  if (!tipFor(kind, id)) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      data-tip-kind={kind}
      data-tip-key={id}
      data-tip-title={title}
      aria-label={`${title}: ne işe yarar?`}
      title="Ne işe yarar?"
      className={cx(
        "inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border border-warn/40 bg-warn/10 align-middle text-warn transition hover:bg-warn/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-warn",
        className,
      )}
    >
      <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Adın Türkçe anlamı (ör. "Würgegriff · Boğma tutuşu"). */
export function Meaning({ kind, id, className }: { kind: TipKind; id: string; className?: string }) {
  const m = tipFor(kind, id)?.meaning;
  if (!m) return null;
  return <span className={cx("text-xs italic text-muted", className)}>{m}</span>;
}
