"use client";
import { Lightbulb, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tipFor, type TipKind } from "@/lib/shz/tips";

interface Open {
  title: string;
  kind: TipKind;
  key: string;
  el: HTMLElement;
}

/**
 * Sayfadaki tüm [data-tip-kind] öğeleri için tek bir açıklama balonu.
 * Hem TipButton düğmeleri hem de kural metnindeki terimler (stat adları, Corruption, Cower…) bunu kullanır.
 */
export function TipLayer() {
  const [open, setOpen] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const show = (el: HTMLElement) => {
      const kind = el.dataset.tipKind as TipKind;
      const key = el.dataset.tipKey ?? "";
      if (!tipFor(kind, key)) return false;
      setOpen({ kind, key, title: el.dataset.tipTitle || el.textContent || key, el });
      return true;
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const el = t?.closest<HTMLElement>("[data-tip-kind]");
      if (el) {
        if (show(el)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (box.current && t && box.current.contains(t)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(null);
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip-kind][role=button]");
      if (el && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        e.stopPropagation();
        show(el);
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  // Balonu hedefin altına (sığmazsa üstüne) yerleştir, ekran dışına taşırma; kaydırınca hedefi izle.
  useEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      if (!box.current) return;
      if (!open.el.isConnected) return setOpen(null);
      const r = open.el.getBoundingClientRect();
      const b = box.current.getBoundingClientRect();
      const m = 8;
      const left = Math.max(m, Math.min(r.left + r.width / 2 - b.width / 2, window.innerWidth - b.width - m));
      let top = r.bottom + 8;
      if (top + b.height > window.innerHeight - m) top = Math.max(m, r.top - b.height - 8);
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  if (!open) return null;
  const tip = tipFor(open.kind, open.key)!;
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={`${open.title} açıklaması`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      className="fixed z-[60] w-[min(20rem,calc(100vw-16px))] rounded-xl border border-warn/40 bg-surface p-4 text-left shadow-2xl"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-serif text-base leading-snug text-ink">
          <Lightbulb className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          {open.title}
        </p>
        <button type="button" onClick={() => setOpen(null)} className="-mr-1 -mt-1 rounded p-1 text-muted hover:text-ink" aria-label="Kapat">
          <X className="h-4 w-4" />
        </button>
      </div>
      {(tip.meaning || tip.say) && (
        <p className="text-sm text-ink/90">
          {tip.meaning && (
            <>
              <span className="text-muted">Anlamı:</span> {tip.meaning}
            </>
          )}
          {tip.say && <span className="ml-1 text-xs text-muted">{tip.meaning ? "· " : ""}okunuşu “{tip.say}”</span>}
        </p>
      )}
      {tip.summary ? (
        <p className="mt-2 rounded-lg bg-surface2/70 px-3 py-2 text-sm leading-relaxed text-ink">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-widest text-warn">Ne işe yarar?</span>
          {tip.summary}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">Bu yeteneğin açıklaması henüz yazılmadı.</p>
      )}
    </div>
  );
}
