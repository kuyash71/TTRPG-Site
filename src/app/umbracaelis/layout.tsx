import type { Metadata } from "next";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: "Umbra Caelis", template: "%s · Umbra Caelis" },
    description: t("Umbra Caelis TTRPG: kural kitabı, kampanyalar, karakterler ve oyun odası."),
  };
}

/** umbracaelis.com/umbracaelis: Umbra Caelis bölümü (yumuşak altın + lavanta tema). */
export default function UmbraCaelisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="uc-theme flex min-h-dvh flex-col text-ink">
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
