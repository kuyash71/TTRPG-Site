# Arayüz çevirisi (TR → EN)

Kaynak dil Türkçedir. Anahtar, Türkçe metnin **kendisidir** (gettext gibi). İngilizce karşılıklar
`src/i18n/en/*.json` parçalarında durur; `npm run i18n:index` (ya da `npx tsx scripts/i18n-index.ts`)
bunları `src/i18n/en.ts` dosyasında birleştirir. Terimler için `content/i18n/GLOSSARY.md` esastır.

## Nasıl kullanılır

| Nerede | Nasıl |
|---|---|
| `"use client"` bileşen | `import { useT, useLocale } from "@/i18n/client"; const t = useT();` |
| async sunucu bileşeni / sayfa / layout / `generateMetadata` | `import { getT, getLocale } from "@/i18n/server"; const t = await getT(); const loc = await getLocale();` |
| API (route()) | `throw bad("Türkçe mesaj")` — route() isteğin diline kendisi çevirir. Değişkenli: `bad("{stat} zaten {max}.", { stat, max })` |
| Kayda yazılan metin (addLog, zar notu, sistem mesajı) | `fmt("Serbest puan: {stat} {from} → {to}", { … })` ile Türkçe yazılır; gösterirken `translateLoose(loc, text)` ile çevrilir |
| Saf fonksiyon (kural motoru) dönen sorun/uyarı metni | `fmt("…{x}…", { x })` ile üret; gösterilen yerde `const tLoose = useTLoose()` (istemci) / `await getTLoose()` (sunucu) ile `tLoose(text)` |
| Tarih / sayı | `toLocaleString(intlLocale(loc))` (`@/i18n/core`) |

Değişkenler `{ad}` biçimindedir: `t("{n} yetenek", { n: 3 })`. Sözlük girdisi:
`"{n} yetenek": "{n} abilities"`. **Asla** `t(\`… ${x} …\`)` yazma: anahtar sabit bir metin olmalı.

Çevrilecekler: JSX metni, `title`, `placeholder`, `aria-label`, `label`/`hint` gibi prop metinleri,
toast/onay metinleri, `metadata.title`, select seçenekleri, sabit etiket tabloları (gösterildikleri yerde
`t(STATUS_LABEL[s].label)` gibi sarılır).

Çevrilmeyecekler: kullanıcı verisi (karakter/kampanya adları, notlar), kural içeriğinden gelen metinler
(yetenek/perk adları ve açıklamaları zaten `content/*.en.json` ile çevrili gelir), stat adları
(Yalman, Korp…), özel adlar, CSS sınıfları, anahtarlar, URL'ler, `data-testid`.

## Kural içeriği

`ucContent(loc)`, `ucClass(key, loc)`, `ucDal(key, loc)`, `ucAbility(key, loc)`, `ucRulesData(loc)`,
`content(loc)`, `getTree(key, loc)`, `rulesData(loc)` … sunucu sayfalarında `loc` ile çağrılır. İstemciye
giden içerik böylece çevrili gider. Kural motoru (rules.ts) yalnızca anahtar ve sayılarla çalışır.

## Bileşen türü kuralı

- Hook (`useT`) yalnızca istemci bileşeninde çalışır. Hem sunucu sayfasından hem istemciden kullanılan
  sunum bileşenleri (`components/uc/cards.tsx` gibi) `"use client"` yapılabilir; **ancak** böyle bir dosyadan
  sunucu tarafında kullanılan sabit/fonksiyon (ör. `TIER_LABEL`) dışa aktarılıyorsa onu ayrı, `"use client"`
  olmayan bir modüle taşı (istemci modülünden sunucuya yalnızca bileşen geçer).
- Async olmayan, hook kullanmayan sunucu bileşenlerinde ya bileşeni async yap (`await getT()`), ya `"use client"`
  yap, ya da `t` / `loc` prop olarak geçir.

## Denetim

`npx tsx scripts/i18n-check.ts <dosya veya klasör…>` sözlükte eksik anahtarları ve sarılmamış görünen
Türkçe satırları listeler (Türkçe karakter içermeyen Türkçe metinleri yakalayamaz; dosyayı baştan sona oku).
