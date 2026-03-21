import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-void p-8">
      <div className="text-center">
        <h1 className="heading-gothic mb-2 text-4xl font-bold text-lavender-400">
          Umbra Caelis
        </h1>
        <p className="mb-8 font-body text-zinc-400">
          Masanı kur, karakterini oluştur, maceraya atıl.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-lavender-400 px-6 py-2 font-medium text-void transition-colors hover:bg-lavender-500"
          >
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-border px-6 py-2 font-medium text-zinc-300 transition-colors hover:border-lavender-400 hover:text-lavender-400"
          >
            Kayıt Ol
          </Link>
        </div>
      </div>
    </main>
  );
}
