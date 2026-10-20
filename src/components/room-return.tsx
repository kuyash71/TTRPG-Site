"use client";
import { ArrowLeft, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { roomHref, type Sys } from "@/lib/links";
import { useEffect, useState } from "react";

/** Oyun odasından başka bir sayfaya geçilince sağ altta "Oyun odasına dön" düğmesi. */
export function RoomReturn() {
  const path = usePathname();
  const [room, setRoom] = useState<{ id: string; name: string; system?: Sys } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("shz:lastRoom");
      setRoom(raw ? JSON.parse(raw) : null);
    } catch {
      setRoom(null);
    }
  }, [path]);
  if (!room || !/^[A-Za-z0-9_-]+$/.test(room.id) || path.endsWith(`/kampanya/${room.id}/oda`)) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center overflow-hidden rounded-full border border-accent/50 bg-surface/95 shadow-card backdrop-blur">
      <AppLink href={roomHref(room.system === "UC" ? "UC" : "SHZ", room.id)} className="flex items-center gap-2 py-2.5 pl-4 pr-3 text-sm text-ink hover:text-accent">
        <ArrowLeft className="h-4 w-4" />
        <span>
          Oyun odasına dön <span className="hidden text-muted sm:inline">· {room.name}</span>
        </span>
      </AppLink>
      <button
        type="button"
        aria-label="Kapat"
        className="border-l border-line px-2.5 py-2.5 text-muted hover:text-ink"
        onClick={() => {
          try {
            sessionStorage.removeItem("shz:lastRoom");
          } catch {
            /* yok say */
          }
          setRoom(null);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
