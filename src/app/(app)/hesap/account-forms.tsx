"use client";
import { useRouter } from "next/navigation";
import { useAction } from "@/components/interactive";
import { Button, Card, Field } from "@/components/ui";
import { useT } from "@/i18n/client";
import { api } from "@/lib/client";

export function AccountForms() {
  const router = useRouter();
  const { busy, run } = useAction();
  const t = useT();
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-4 font-serif text-lg">{t("Şifre değiştir")}</h2>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            if (f.get("next") !== f.get("next2")) return run(async () => Promise.reject(new Error(t("Yeni şifreler aynı değil."))));
            const ok = await run(() => api("/api/account/password", { body: { current: f.get("current"), next: f.get("next") } }), t("Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı."));
            if (ok) form.reset();
          }}
        >
          <Field label={t("Mevcut şifre")}>
            <input name="current" type="password" autoComplete="current-password" required className="input" />
          </Field>
          <Field label={t("Yeni şifre")} hint={t("En az 10 karakter")}>
            <input name="next" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" />
          </Field>
          <Field label={t("Yeni şifre (tekrar)")}>
            <input name="next2" type="password" autoComplete="new-password" required minLength={10} maxLength={128} className="input" />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            {t("Şifreyi değiştir")}
          </Button>
        </form>
      </Card>
      <Card className="p-6">
        <h2 className="mb-2 font-serif text-lg">{t("Oturumlar")}</h2>
        <p className="mb-4 text-sm text-muted">{t("Başka bir cihazda açık kaldığını düşünüyorsan tüm oturumları kapat.")}</p>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            const ok = await run(() => api("/api/account/logout-all", { body: {} }));
            if (ok) {
              router.replace("/giris");
              router.refresh();
            }
          }}
        >
          {t("Tüm cihazlardan çıkış yap")}
        </Button>
      </Card>
    </div>
  );
}
