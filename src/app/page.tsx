import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-amber-500">
          TTRPG Oyun Yonetim
        </h1>
        <p className="mb-8 text-gray-400">
          Masani kur, karakterini olustur, maceraya atil.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="rounded bg-amber-600 px-6 py-2 font-medium text-gray-100 hover:bg-amber-500"
          >
            Giris Yap
          </Link>
          <Link
            href="/register"
            className="rounded border border-gray-700 px-6 py-2 font-medium text-gray-300 hover:border-amber-500 hover:text-amber-500"
          >
            Kayit Ol
          </Link>
        </div>
      </div>
    </main>
  );
}
