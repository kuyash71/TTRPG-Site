import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-serif/500.css";
import "@fontsource/ibm-plex-serif/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ToastProvider } from "@/components/interactive";
import { TipLayer } from "@/components/tip-layer";

export const metadata: Metadata = {
  title: { default: "Schwarzesonne", template: "%s · Schwarzesonne" },
  description: "Schwarzesonne TTRPG: kampanyalar, karakterler ve oyun odası.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#0b0a0e", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP nonce'u için her istek dinamik işlenir.
  await headers();
  return (
    <html lang="tr">
      <body>
        <ToastProvider>
          {children}
          <TipLayer />
        </ToastProvider>
      </body>
    </html>
  );
}
