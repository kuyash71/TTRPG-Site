"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

export function ForgotForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div className="card space-y-4 p-6 text-sm">
        <p className="font-serif text-lg text-ink">İsteğin iletildi</p>
        <p className="text-ink/90">
          Bu kullanıcı adına ait bir hesap varsa istek, oynadığın kampanyaların GM&apos;lerine ve site yöneticisine düştü. GM onayladığında sana <strong>tek kullanımlık bir sıfırlama
          kodu</strong> verecek (kod 24 saat geçerli).
        </p>
        <p className="text-muted">Kodu aldığında giriş ekranında &quot;Sıfırlama kodum var&quot;ı seç, kullanıcı adını ve kodu yaz. Giriş yapınca yeni şifreni belirleyeceksin.</p>
        <Link href="/giris" className="inline-block text-accent hover:underline">
          ← Girişe dön
        </Link>
      </div>
    );
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/forgot", { body: { username: f.get("username") } });
          setSent(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="font-serif text-lg text-ink">Şifremi unuttum</p>
        <p className="mt-1 text-sm text-muted">Kullanıcı adını yaz. GM&apos;in isteği onaylayınca sana tek kullanımlık bir kod verir; o kodla girip yeni şifreni belirlersin.</p>
      </div>
      <Field label="Kullanıcı adı">
        <input name="username" autoComplete="username" required maxLength={40} className="input" autoFocus />
      </Field>
      {error && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? "Gönderiliyor…" : "GM'e sıfırlama isteği gönder"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/giris" className="text-muted hover:text-ink">
          ← Girişe dön
        </Link>
      </p>
    </form>
  );
}
