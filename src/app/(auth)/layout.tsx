import Link from "next/link";
import { SunLogo } from "@/components/logo";

/** Giriş, kayıt ve şifre ekranlarının ortak çerçevesi. Oturum yönlendirmeleri her sayfanın kendisindedir. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, rgb(186 168 240 / 0.14), transparent 60%), radial-gradient(40rem 20rem at 50% 110%, rgb(186 168 240 / 0.06), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <SunLogo className="mx-auto h-16 w-16 text-accent" />
          <h1 className="mt-3 font-serif text-2xl tracking-[0.12em]">SCHWARZESONNE</h1>
          <p lang="en" className="mt-1 inline-block bg-accent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-onAccent">Campaigns</p>
        </div>
        {children}
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/kurallar" className="hover:text-ink">
            Kuralları oku →
          </Link>
        </p>
      </div>
    </div>
  );
}
