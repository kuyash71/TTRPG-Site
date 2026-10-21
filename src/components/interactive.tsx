"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { cx } from "./ui";

// ---------------------------------------------------------------- bildirimler
type Toast = { id: number; text: string; tone: "ok" | "error" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto max-w-md rounded-lg border px-4 py-2.5 text-sm shadow-card backdrop-blur",
              t.tone === "error" && "border-danger/50 bg-danger/15 text-ink",
              t.tone === "ok" && "border-ok/50 bg-ok/15 text-ink",
              t.tone === "info" && "border-line bg-surface2/95 text-ink",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Bir API çağrısını yükleniyor durumu ve hata bildirimiyle sarmalar. */
export function useAction() {
  const toast = useToast();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (okText) toast(okText, "ok");
        return r;
      } catch (e) {
        toast(e instanceof Error ? e.message : t("Bir hata oluştu."), "error");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast, t],
  );
  return { busy, run };
}

// ---------------------------------------------------------------- pencere
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <h2 className="font-serif text-lg">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:bg-surface2 hover:text-ink" aria-label={t("Kapat")}>
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// ---------------------------------------------------------------- sekmeler
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: K; label: ReactNode; badge?: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition",
            value === t.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

export function useHashTab<K extends string>(keys: readonly K[], def: K) {
  const [tab, setTab] = useState<K>(def);
  useEffect(() => {
    const h = window.location.hash.slice(1) as K;
    if (keys.includes(h)) setTab(h);
  }, [keys]);
  const change = (k: K) => {
    setTab(k);
    history.replaceState(null, "", `#${k}`);
  };
  return [tab, change] as const;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* pano izni yok */
        }
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-ink"
    >
      {done ? t("Kopyalandı") : (label ?? t("Kopyala"))}
    </button>
  );
}

/** Sekme içi alt sekmeler (yuvarlak düğme grubu). */
export function SubTabs<K extends string>({ tabs, value, onChange, className }: { tabs: { key: K; label: ReactNode; badge?: ReactNode }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          data-testid={`subtab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={cx("flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition", value === t.key ? "bg-accent/15 text-ink" : "text-muted hover:text-ink")}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}
