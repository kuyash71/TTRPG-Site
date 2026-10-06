import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TopNav } from "@/components/nav";
import { RoomReturn } from "@/components/room-return";
import { currentUser } from "@/lib/auth/session";
import { START_FREE_STATS, START_KLANG, THRESHOLDS, WOUNDS } from "@/lib/shz/constants";

export const metadata: Metadata = { title: "Yardım" };

const SECTIONS = [
  { id: "baslarken", title: "Başlarken" },
  { id: "karakter", title: "Karakter oluşturma" },
  { id: "dikkat", title: "Nelere dikkat etmeli?" },
  { id: "zar", title: "Zarlar nasıl çalışır?" },
  { id: "gelisim", title: "Seviye ve yetenekler" },
  { id: "oda", title: "Oyun odası" },
  { id: "beden", title: "Yara, Corruption, Death Save" },
  { id: "gm", title: "GM için" },
  { id: "sss", title: "Sık sorulanlar" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line pb-10 pt-2">
      <h2 className="mb-4 text-2xl">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[32px_1fr] gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 font-mono text-sm text-accent">{i + 1}</span>
          <div>
            <p className="font-medium text-ink">{s.title}</p>
            <div className="text-sm text-ink/80">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "warn" }) {
  return (
    <div className={tone === "warn" ? "rounded-lg border-l-2 border-warn bg-warn/10 px-4 py-3 text-sm" : "rounded-lg border-l-2 border-accent bg-accent/[0.07] px-4 py-3 text-sm"}>
      {children}
    </div>
  );
}

export default async function HelpPage() {
  const user = await currentUser();
  return (
    <>
      <TopNav user={user} />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr] lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted">Yardım</p>
          <nav className="flex flex-wrap gap-1 lg:block">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1.5 text-sm text-muted hover:bg-surface2 hover:text-ink">
                {s.title}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 max-w-3xl space-y-10">
          <header className="border-b border-line pb-6">
            <p className="kicker mb-2">Rehber</p>
            <h1 className="text-3xl sm:text-4xl">Yardım</h1>
            <p className="mt-2 text-muted">
              Siteyi ve Schwarzesonne kurallarını hızlıca öğrenmek için kısa bir rehber. Kuralların tam metni{" "}
              <Link href="/kurallar" className="text-accent hover:underline">
                Kurallar
              </Link>{" "}
              bölümünde.
            </p>
          </header>

          <Section id="baslarken" title="Başlarken">
            <Steps
              items={[
                { title: "Hesap aç", body: <>GM&apos;inden bir davet bağlantısı al. Bağlantıyı açıp kullanıcı adı ve en az 10 karakterlik bir şifre belirle. Kod tek kullanımlıktır.</> },
                {
                  title: "Kampanyaya katıl",
                  body: <>Davet bir kampanyaya bağlıysa otomatik katılırsın. Değilse Panel&apos;deki &quot;Kampanyaya katıl&quot; kutusuna GM&apos;in verdiği katılma kodunu (ör. ABCD-EFGH) yaz.</>,
                },
                { title: "Karakterini oluştur", body: <>Kampanya sayfasındaki &quot;Karakter oluştur&quot; düğmesiyle sihirbazı başlat. Karakterin GM onayından sonra aktif olur.</> },
                { title: "Oyun odasına gir", body: <>Oyun günü kampanyadaki &quot;Oyun odası&quot; düğmesiyle masaya otur. Sohbet, zarlar ve parti burada.</> },
              ]}
            />
          </Section>

          <Section id="karakter" title="Karakter oluşturma">
            <p>Sihirbaz altı adımdan oluşur. Sağdaki özet her seçimde güncellenir ve eksik bir şey varsa orada yazar.</p>
            <Steps
              items={[
                {
                  title: "Kimlik",
                  body: (
                    <>
                      Ad, yaş (18–60), milliyet ve taraf (alignment). <strong>Geçmiş</strong> herkesin görebileceği hikâyedir. <strong>GM&apos;e özel notlar</strong> alanını yalnızca sen ve GM
                      görürsünüz: sırlar ve hikâye kancaları için ideal.
                    </>
                  ),
                },
                {
                  title: "Ekspertiz ağacı",
                  body: (
                    <>
                      Başlangıç ağacın sembol stat&apos;ına +2 verir ve ağaca özel bir bonus kazandırır (ör. Ubermann +1 Krach, Schwarzesonne +1 Corruption, Metallkorp bir T1 augment).
                      İkinci ağacı oyunda yetenek puanıyla açarsın; en fazla 2 ağaç olabilir.
                    </>
                  ),
                },
                {
                  title: "Perkler",
                  body: (
                    <>
                      Pozitif perkler perk puanı harcar, negatifler kazandırır. Toplam negatife düşemez. Kalan puan (puan + 1) / 2 olarak stat puanına dönüşür. Turuncu etiketli perkler
                      birlikte alınamaz; seçilen bir perkle çakışanlar kilitlenir. <strong>Kriegsversehrt</strong> seçersen kopuk başlayacak 1 ya da 2 uzuv seçersin (kol seçilirse el,
                      bacak seçilirse ayak da kopar; baş ve gövde seçilemez). Tek uzuv 4, iki uzuv 7 perk puanı kazandırır.
                    </>
                  ),
                },
                {
                  title: "Augment (yalnızca Metallkorp)",
                  body: (
                    <>
                      İlk ağacın Metallkorp ise perklerden sonra ayrı bir Augment adımı açılır: bir T1 augment ve takılacağı uzvu seçersin. Kopuk uzvuna augment takarsan protez olarak çalışır ve uzuv
                      sağlam sayılır; kopuk bir kolun eline ya da kopuk bir bacağın ayağına augment takılamaz.
                    </>
                  ),
                },
                {
                  title: "Statlar",
                  body: (
                    <>
                      {START_FREE_STATS} varsayılan puan + perklerden gelen puanları dağıtırsın. Ağaç stat&apos;ın zaten +2 aldığı için ona yalnızca perklerden gelen kadar puan ekleyebilirsin.
                      Klang herkese +{START_KLANG} başlar.
                    </>
                  ),
                },
                { title: "İlk yetenek", body: <>Seviye 0&apos;da 1 yetenek puanın var. Şartlarını karşıladığın bir yeteneği şimdi alabilir ya da puanı saklayabilirsin.</> },
                { title: "Özet ve onay", body: <>Her şeyi kontrol et ve &quot;Onaya gönder&quot; de. GM reddederse nedenini karakter sayfasında görürsün.</> },
              ]}
            />
            <Tip>Portreni karakter oluşturduktan sonra karakter kağıdında portre alanına tıklayarak ekleyebilirsin (PNG, JPEG veya WebP).</Tip>
            <Tip>Karakterin adını, geçmişini ve görünüşünü sonradan karakter kağıdındaki "İsim / açıklama" düğmesiyle değiştirebilirsin. GM de oyuncuların karakterlerinde bunu yapabilir; değişiklik karakter kaydına yazılır.</Tip>
          </Section>

          <Section id="dikkat" title="Nelere dikkat etmeli?">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Rolünü düşün, sayıyı değil.</strong> Negatif perkler puan kazandırır ama oyunda gerçekten oynanır. GM bunları hikâyeye taşıyacaktır.
              </li>
              <li>
                <strong>Ağacın ilerisine bak.</strong> Kol bitirici yetenekler ana stat 7, ikincil stat 4–5 ve seviye 6–7 ister. Kurallar &gt; Yetenek ağaçları sayfasından hangi ikincil
                statlara ihtiyacın olacağını önceden gör.
              </li>
              <li>
                <strong>Klang&apos;ı ihmal etme.</strong> Augmentler Klang düşürür. Klang negatife inerse <em>bütün</em> zarlarına o kadar ceza gelir.
              </li>
              <li>
                <strong>Corruption geri gelmez.</strong> 7&apos;ye ulaşan Corruption bir daha 7&apos;nin altına inmez; 13 ölüm demektir. Pervitin kullanırken iki kez düşün.
              </li>
              <li>
                <strong>Inspiration borcu.</strong> Inspiration eksiye düşerse her eksi puan için tüm zarlarına −2 uygulanır.
              </li>
              <li>
                <strong>Tek karakter.</strong> Bir kampanyada aynı anda yalnızca bir aktif ya da onay bekleyen karakterin olabilir.
              </li>
            </ul>
          </Section>

          <Section id="zar" title="Zarlar nasıl çalışır?">
            <p>
              Temel kural: <strong>d20 + stat ≥ eşik</strong>. Zarları her zaman sunucu atar; herkes aynı sonucu ve tüm eklemeleri görür.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full max-w-md text-sm">
                <tbody>
                  {THRESHOLDS.map((t) => (
                    <tr key={t.key} className="border-b border-line">
                      <td className="py-1.5 pr-4">{t.label}</td>
                      <td className="py-1.5 font-mono">{t.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Nat 20 ve Nat 1 eşikten bağımsızdır: olası en iyi ve en kötü sonuç.</li>
              <li>Zar panelinde kullandığın uzvu seçersen o uzvun yara cezası otomatik eklenir.</li>
              <li>Negatif Klang, Inspiration borcu ve kara büyü zarlarındaki Corruption etkileri otomatik hesaplanır.</li>
              <li>Bir zarın altındaki &quot;Inspiration harca, yeniden at&quot; ile 1 Inspiration karşılığında zarı yeniden atabilirsin.</li>
              <li>&quot;Durum düzenleyici&quot; GM&apos;in söylediği anlık artı/eksiler içindir; herkes görür.</li>
            </ul>
          </Section>

          <Section id="gelisim" title="Seviye ve yetenekler">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Seviye atlamayı GM yapar. Her seviyede +1 yetenek puanı, ağaç stat&apos;ına +1 ve GM&apos;in seçtiği aksiyon stat&apos;ına +1 alırsın. MVP ayrıca +1 alır.</li>
              <li>Ağaç stat&apos;ın 10 olduysa o puan &quot;serbest stat&quot; olarak gelir; karakter kağıdında istediğin stat&apos;a verirsin.</li>
              <li>
                Yetenek puanını karakter kağıdının <strong>Yetenekler</strong> sekmesinde harcarsın. Yeşil kenarlı yetenekler alınabilir; kilitli olanların altında eksik şart yazar
                (öncül, stat, seviye, Corruption).
              </li>
              <li>Bir yeteneğin 3. seviyesi için karakter seviyesi en az 4 olmalı.</li>
              <li>
                Ağaç görünümünde <strong>Kök</strong> yetenek üstte, iki ana kol (A ve B) yan yana durur. Kartlar arasındaki çizgi öncül sırasını gösterir; kesik çizgili blok bir{" "}
                <strong>yan daldır</strong> (A′, B′) ve üstündeki yetenekten ayrılır. Kartın üstündeki &quot;Öncül&quot; satırı kırmızıysa önce o yeteneği almalısın.
              </li>
              <li>İkinci ağacı açabilecek durumdaysan Yetenekler sekmesinde &quot;YENİ AĞAÇ AÇILABİLİR&quot; uyarısı ve &quot;Ağaç aç&quot; düğmesi çıkar.</li>
              <li>Perklerin sabit stat etkileri (ör. +2 Rede, −2 Leis) statlarına otomatik yansır; statın altında hangi perk ya da augment&apos;ten geldiği yazar. Olumsuz etkiler statı 0&apos;ın altına da düşürebilir.</li>
              <li>GM izin verirse perklerini bir kez yeniden düzenleyebilirsin (karakter kağıdında &quot;Perkleri düzenle&quot;).</li>
              <li>Bazı yetenekler başka bir yetenekle birlikte alındığında <strong>sinerji</strong> kazanır; aktif sinerjiler kartta yazar.</li>
            </ul>
          </Section>

          <Section id="oda" title="Oyun odası">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Sahne (IC):</strong> karakterinin söyledikleri ve yaptıkları, zarlar ve sistem mesajları. <strong>Masa (OOC):</strong> oyun dışı sohbet.{" "}
                <strong>Fısıltılar:</strong> GM ile özel konuşma; GM her oyuncuyla ayrı bir konuşma görür.
              </li>
              <li>
                Kendi mesajını silebilirsin (mesajın üstüne gelince çıkan çöp kutusu). Birden çok mesajı silmek için sekme çubuğundaki <strong>Seç</strong> düğmesine bas, mesajları işaretle
                ve &quot;Seçilenleri sil&quot;. GM her mesajı ve zarı silebilir.
              </li>
              <li>
                <strong>İzleyiciler</strong> masayı izler: karakter oluşturamaz, sahneye yazamaz ve zar atamaz; Masa sohbetine ve GM&apos;e fısıltıyla yazabilir. Oda başlığında
                &quot;İzleyici&quot; etiketi görünür.
              </li>
              <li>GM bir oyuncuyu sohbette ya da zar atmada susturabilir. Sohbette susturulan oyuncu yine de GM&apos;e fısıldayabilir.</li>
              <li>Kampanyada karakterin yoksa odaya girince sana karakter oluşturmak isteyip istemediğin sorulur.</li>
              <li>Partideki bir karakterin portresine ya da adına tıklayınca karakteri odadan çıkmadan görürsün.</li>
              <li>GM &quot;zar iste&quot; dediğinde akışın altında bir kart çıkar; tek tıkla doğru zarı atarsın. Eşik, düzenleyici ve stat&apos;ı GM belirler.</li>
              <li>Zar attığında sonuç ekranın üstünde kısa bir bildirim olarak görünür ve sahne en alta kayar. Bildirime dokununca akışa gidersin.</li>
              <li>Inspiration ile yeniden atmadan önce zarın ayrıntıları ve kalan Inspiration&apos;ın gösterilir; onaylayınca harcanır.</li>
              <li>
                <strong>Death Save</strong> ve <strong>Pervitin</strong> zarlarını yalnızca GM ister. Death Save kartı ölüm ve kurtuluş sayısını gösterir; üç ölümde karakter
                &quot;Öldü&quot; olarak işaretlenir, GM diriltebilir.
              </li>
              <li>Sağ üstteki &quot;Karakterim&quot; düğmesi seni karakter kağıdına götürür; karakterin yoksa &quot;Karakter Oluştur&quot; yazar.</li>
              <li>Odadan başka bir sayfaya geçersen sağ alttaki &quot;Oyun odasına dön&quot; düğmesiyle geri dönersin.</li>
            </ul>
          </Section>

          <Section id="beden" title="Yara, Corruption, Death Save">
            <p>Can puanı yoktur; her uzvun kendi yara durumu vardır. Yaralı uzvun kullanıldığı zarlara ceza gelir:</p>
            <div className="flex flex-wrap gap-2">
              {WOUNDS.map((w) => (
                <span key={w.key} className="chip">
                  {w.label} {w.penalty ? `−${w.penalty}` : ""}
                </span>
              ))}
            </div>
            <p className="text-sm text-ink/80">Temiz sargı cezayı yarıya, kirli sargı dörtte üçe indirir (aşağı yuvarlanır).</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Corruption 0–13 arasıdır; her seviyenin etkisi karakter kağıdındaki çizgide ve Kurallar &gt; Corruption sayfasında yazar.</li>
              <li>Death Save: d6 atılır, 1–3 ölüm, 4–6 kurtuluş. Hangisi önce 3 olursa o gerçekleşir. Hak kullanılınca Inspiration ile yenilenir; her yenileme 1 fazla Inspiration ister.</li>
            </ul>
          </Section>

          <Section id="gm" title="GM için">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Davet:</strong> Yönetim &gt; Yeni davet. Kampanya seçersen oyuncu kayıt olunca otomatik katılır.
              </li>
              <li>
                <strong>Onay:</strong> Kampanya sayfasında &quot;Onay bekleyen karakterler&quot;. Reddederken bir not yazabilirsin.
              </li>
              <li>
                <strong>Seviye atlatma:</strong> Kampanya sayfasında karakterleri seç, her biri için aksiyon stat&apos;ını ve MVP&apos;yi belirle.
              </li>
              <li>
                <strong>Düzenleme:</strong> Karakter kağıdında &quot;GM düzenle&quot; ile stat, puan, Corruption, Inspiration, yetenek ve perkleri değiştirebilirsin; her değişiklik kayda geçer.
                Yara, sargı ve augmentler Beden sekmesinden.
              </li>
              <li>
                <strong>Oyun odasında:</strong> gizli zar atabilir, oyunculardan zar isteyebilir, parti kartlarından Corruption ve Inspiration&apos;ı hızlıca değiştirebilirsin.
                &quot;Masada&quot; listesindeki simgelerle bir oyuncuyu sohbette ya da zar atmada susturabilir ya da oyundan atabilirsin.
              </li>
              <li>
                <strong>Zar paneli:</strong> &quot;Statsız&quot; ile stat eklenmeyen aksiyonlar atılır; &quot;Elle&quot; kutusuna istediğin eşiği yazabilirsin. Death Save ve Pervitin&apos;i
                doğrudan atabilirsin; Pervitin&apos;e durum düzenleyicisi eklenir.
              </li>
              <li>
                <strong>Zar iste:</strong> Normal zar, Death Save veya Pervitin isteyebilirsin; stat (ya da statsız), hazır ya da elle eşik, durum düzenleyicisi, kara büyü, oyuncunun
                uzuv seçmesi ve sonucu gizleme seçenekleri var. Bekleyen istekleri akışın altından iptal edebilirsin.
              </li>
              <li>
                <strong>Odayı kapatma:</strong> Kampanya sayfasının en altındaki &quot;Odayı kapat&quot; kampanyayı karakterleri, sohbet ve zar geçmişiyle birlikte kalıcı olarak siler.
                Kapatabilmek için önce tüm oyuncuları ve izleyicileri çıkarman gerekir. Yalnızca dondurmak istiyorsan ayarlardan durumu &quot;Arşiv&quot; yap.
              </li>
              <li>
                <strong>Geçmişi silme:</strong> &quot;Seç&quot; ile mesaj ve zarları toplu seçip silebilirsin. &quot;Temizle&quot; düğmesi sahne mesajlarını, masa sohbetini, bir oyuncuyla
                ya da tüm oyuncularla olan fısıltıları, zar geçmişini veya her şeyi tek seferde siler.
              </li>
              <li>
                <strong>İzleyiciler:</strong> Kampanya sayfasındaki &quot;İzleyici kodu&quot; ile hesabı olanlar izleyici olarak katılır; yeni kişiler için Yönetim &gt; Yeni davet&apos;te
                rolü &quot;İzleyici&quot; seç. Var olan bir üyeyi kampanya sayfasından ya da odadaki göz simgesiyle izleyici/oyuncu yapabilirsin.
              </li>
              <li>
                <strong>İade ve izinler:</strong> GM düzenle ekranındaki &quot;Puanları iade et&quot; tüm dağıtılmış stat ve yetenek puanlarını oyuncuya geri verir. &quot;Oyuncu perklerini
                düzenleyebilir&quot; kutusu tek seferlik perk düzenleme izni verir. Ölü karakteri parti kartından ya da karakter kağıdından diriltebilirsin.
              </li>
              <li>
                <strong>Kurallar:</strong> Obsidian&apos;daki kuralları güncelledikten sonra <code className="rounded bg-surface2 px-1">npm run sync</code> çalıştırıp push etmen yeterli.
              </li>
            </ul>
          </Section>

          <Section id="sss" title="Sık sorulanlar">
            <dl className="space-y-4">
              {[
                ["Şifremi unuttum.", "GM'ine haber ver; site yöneticisi hesabını sıfırlayabilir."],
                ["Karakterim reddedildi, ne yapmalıyım?", "Karakter sayfasındaki GM notunu oku ve kampanya sayfasından yeni bir karakter oluştur."],
                ["Bir yeteneği yanlışlıkla aldım.", "GM'ine söyle; GM düzenle ekranından geri alıp puanını iade edebilir."],
                ["Karakterimi silmek istiyorum.", "Karakter kağıdında 'Karakteri sil' düğmesine bas ve onay için karakterin adını yaz. Silme geri alınamaz."],
                ["Oyun odası 'Bağlanıyor…' yazıyor.", "Sayfayı yenile. Devam ederse oturumun kapanmış olabilir; yeniden giriş yap."],
                ["Bir sayfada 'Bir şeyler ters gitti' yazdı.", "Site bu durumda sayfayı bir kez kendiliğinden yeniler. Sorun sürerse ekrandaki kodu GM'ine ilet."],
              ].map(([q, a]) => (
                <div key={q}>
                  <dt className="font-medium text-ink">{q}</dt>
                  <dd className="text-sm text-ink/80">{a}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </main>
      </div>
      {user && <RoomReturn />}
    </>
  );
}
