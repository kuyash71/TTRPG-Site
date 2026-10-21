"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [withCode, setWithCode] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ mustChangePassword?: boolean }>("/api/auth/login", { body: { username: f.get("username"), password: f.get("password") } });
          if (r.mustChangePassword) router.replace("/sifre-yenile");
          // Umbra Caelis bölümü uygulama alt yolunun dışında: tam sayfa geçişi.
          else if (next.startsWith("/umbracaelis")) window.location.assign(next);
          else router.replace(next);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <Field label={t("Kullanıcı adı")}>
        <input name="username" autoComplete="username" required maxLength={40} className="input" autoFocus />
      </Field>
      <Field label={withCode ? t("Sıfırlama kodu") : t("Şifre")} hint={withCode ? t("GM'inin verdiği tek kullanımlık kod (ör. SIF-7KQM-X2PA-…). Girişten sonra yeni şifreni belirleyeceksin.") : undefined}>
        <input
          name="password"
          type={withCode ? "text" : "password"}
          autoComplete={withCode ? "one-time-code" : "current-password"}
          required
          maxLength={200}
          className={withCode ? "input font-mono uppercase tracking-wider" : "input"}
          key={withCode ? "code" : "pw"}
        />
      </Field>
      {error && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? t("Giriş yapılıyor…") : withCode ? t("Kodla giriş yap") : t("Giriş yap")}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/sifremi-unuttum" className="text-muted hover:text-ink">
          {t("Şifremi unuttum")}
        </Link>
        <button type="button" className="text-muted hover:text-ink" onClick={() => setWithCode(!withCode)}>
          {withCode ? t("Şifreyle gir") : t("Sıfırlama kodum var")}
        </button>
      </div>
      <p className="border-t border-line pt-3 text-center text-sm text-muted">
        {t("Davet kodun mu var?")}{" "}
        <Link href="/kayit" className="text-accent hover:underline">
          {t("Hesap oluştur")}
        </Link>
      </p>
    </form>
  );
}
