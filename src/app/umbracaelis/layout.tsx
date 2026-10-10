import type { Metadata } from "next";
import { UcTopNav } from "@/components/uc/nav";

export const metadata: Metadata = {
  title: { default: "Umbra Caelis", template: "%s · Umbra Caelis" },
  description: "Umbra Caelis TTRPG kural kitabı: temel kurallar, sınıflar, dallar, yetenekler ve perkler.",
};

/** umbracaelis.com/umbracaelis: Umbra Caelis bölümü (yumuşak altın + lavanta tema). */
export default function UmbraCaelisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="uc-theme flex min-h-dvh flex-col text-ink">
      <UcTopNav />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-line/60 px-4 py-6 text-center text-xs text-muted">
        <a href="/" className="hover:text-ink">
          umbracaelis.com
        </a>{" "}
        · Umbra Caelis TTRPG
      </footer>
    </div>
  );
}
