"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";

export function RegisterForm({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("password") !== f.get("password2")) return setError("Şifreler aynı değil.");
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ system?: "SHZ" | "UC" }>("/api/auth/register", {
            body: { code: f.get("code"), username: f.get("username"), displayName: f.get("displayName"), password: f.get("password") },
          });
          if (r.system === "UC") window.location.assign("/umbracaelis/panel");
          else {
            router.replace("/panel");
            router.refresh();
          }
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-muted">Siteye yalnızca GM'in verdiği davet koduyla kayıt olunabilir.</p>
      <Field label="Davet kodu">
        <input name="code" defaultValue={code} required maxLength={40} placeholder="SHZ-XXXX-XXXX-XXXX-XXXX" className="input font-mono uppercase" />
      </Field>
      <Field label="Kullanıcı adı" hint="3–24 karakter: küçük harf, rakam, _ . -">
        <input name="username" autoComplete="username" required pattern="[a-zA-Z0-9_.\-]{3,24}" maxLength={24} className="input" />
      </Field>
      <Field label="Görünen ad" hint="Oyun odasında diğerlerinin göreceği isim">
        <input name="displayName" required minLength={2} maxLength={40} className="input" />
      </Field>
      <Field label="Şifre" hint="En az 10 karakter. Uzun bir cümle iyi bir şifredir.">
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" />
      </Field>
      <Field label="Şifre (tekrar)">
        <input name="password2" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" />
      </Field>
      {error && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? "Oluşturuluyor…" : "Hesap oluştur"}
      </Button>
      <p className="text-center text-sm text-muted">
        Zaten hesabın var mı?{" "}
        <Link href="/giris" className="text-accent hover:underline">
          Giriş yap
        </Link>
      </p>
    </form>
  );
}
