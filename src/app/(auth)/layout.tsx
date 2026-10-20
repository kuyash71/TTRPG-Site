import Link from "next/link";

/**
 * Giriş, kayıt ve şifre ekranlarının ortak çerçevesi. Amblem her sayfada (AuthBrand) sisteme göre çizilir;
 * oturum yönlendirmeleri her sayfanın kendisindedir. Kurallar iki sistem için de hesapsız okunur.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, rgb(var(--accent) / 0.14), transparent 60%), radial-gradient(40rem 20rem at 50% 110%, rgb(var(--accent) / 0.06), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm">
        {children}
        <div className="mt-6 space-y-1 text-center text-sm text-muted">
          <p className="text-[11px] uppercase tracking-widest">Kurallar · hesap gerekmez</p>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/kurallar" className="hover:text-ink">
              Schwarzesonne kuralları →
            </Link>
            <a href="/umbracaelis/kurallar" className="hover:text-ink">
              Umbra Caelis kuralları →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
