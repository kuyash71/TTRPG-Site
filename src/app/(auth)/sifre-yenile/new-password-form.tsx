"use client";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/client";
import { withBase } from "@/lib/base";

export function NewPasswordForm({ name }: { name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (f.get("next") !== f.get("next2")) return setError("Yeni şifreler aynı değil.");
        setBusy(true);
        setError(null);
        try {
          await api("/api/account/force-password", { body: { next: f.get("next") } });
          window.location.assign(withBase("/panel"));
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="font-serif text-lg text-ink">Yeni şifre belirle</p>
        <p className="mt-1 text-sm text-muted">
          Hoş geldin {name}. Sıfırlama koduyla giriş yaptın; devam etmeden önce yeni bir şifre belirlemelisin. Kod artık geçersiz.
        </p>
      </div>
      <Field label="Yeni şifre" hint="En az 10 karakter">
        <input name="next" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" autoFocus />
      </Field>
      <Field label="Yeni şifre (tekrar)">
        <input name="next2" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" />
      </Field>
      {error && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? "Kaydediliyor…" : "Şifreyi kaydet ve devam et"}
      </Button>
    </form>
  );
}
