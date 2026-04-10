# TTRPG Oyun Yönetim Sitesi — Roadmap

> Son güncelleme: 2026-03

---

## Sprint Planı

| Sprint        | Odak                                | Teslim Edilecekler                                                                                                                                                                                      |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 1**  | Temel altyapı                       | Next.js 14 App Router kurulumu, Prisma + Supabase bağlantısı, NextAuth email/password provider, kullanıcı rolleri (USER/GM/ADMIN), temel User CRUD                                                      |
| **Sprint 2**  | Session sistemi                     | Session oluşturma, `invite_code` üretimi, `/join/[invite_code]` akışı, session durum yönetimi (OPEN → ACTIVE → CLOSING → CLOSED)                                                                        |
| **Sprint 3**  | Gerçek zamanlı                      | Socket.io server (Railway), room sistemi, IC/OOC chat, zar atma (`rpg-dice-roller`), event broadcast altyapısı                                                                                          |
| **Sprint 4**  | Karakter sistemi                    | Character sheet CRUD, public/private veri ayrımı, görünürlük middleware, anlık güncelleme (socket events)                                                                                               |
| **Sprint 5**  | Gameset + Skill Tree (stat kaynağı) | Stat tanımları (BASE/DERIVED/RESOURCE), class/race sistemi, **skill tree editörü (class tree + common tree)**, node seviye/maliyet/stat bonus sistemi, karakter wizard (skill dağıtımlı), GM onay akışı |
| **Sprint 6**  | Inventory + Eşya                    | Grid inventory UI (EFT tarzı), eşya tanımları, equip/unequip → stat bonusu, server-side çakışma algoritması                                                                                             |
| **Sprint 7**  | Büyü sistemi                        | Spell tanımları, slot sistemi, `char:use_spell` event, mana tüketimi, SPELL_UNLOCK node entegrasyonu                                                                                                    |
| **Sprint 8+** | Polishing & v1                      | Dark fantasy UI (Tailwind), mobile optimizasyon, GM panel genişletme, admin dashboard, export sistemi, e-posta bildirimleri (Resend), Vercel Cron cleanup                                               |

---

## Sprint 1 — Detay

**Hedef:** Çalışan auth + temel DB şeması + rol sistemi.

- [x] Next.js 14 App Router projesi oluştur
- [x] Prisma + Supabase PostgreSQL bağlantısı kur
- [x] `users` tablosunu migrate et (id, email, password_hash, username, role)
- [x] NextAuth credential provider (email/password, bcrypt)
- [x] JWT içine `role` ekle
- [x] Rol middleware (`withRole` wrapper)
- [x] `/register`, `/login`, `/dashboard` sayfaları (bare minimum UI)
- [x] NextAuth middleware (protected route + auth page redirect)
- [x] Logout butonu (dashboard)
- [x] Environment variables Vercel'e yükle
- [x] `prisma migrate dev` — Supabase DB'ye ilk migration
- [x] Custom domain bağlantısı (umbracaelis.com)

---

## Sprint 2 — Detay

**Hedef:** GM session oluşturabilir, oyuncu davet koduyla katılabilir.

- [x] `sessions`, `session_players` tabloları
- [x] `gamesets` tablosu (basit, config olmadan)
- [x] `POST /api/sessions` — GM session oluşturur, invite_code üretilir
- [x] `GET /join/[invite_code]` — oyuncu session'a katılır
- [x] Session durum geçişleri (OPEN → ACTIVE → CLOSING → CLOSED)
- [x] GM dashboard: session listesi + yeni session butonu
- [x] Oyuncu dashboard: katıldığı session'lar listesi
- [x] `prisma migrate dev` — Sprint 2 migration'ı Supabase'e uygula

---

## Sprint 3 — Detay

**Hedef:** Canlı oyun odası — chat + zar.

- [x] Ayrı Node.js Socket.io server (Railway deploy)
- [x] Room sistemi: `session:join` / `session:leave`
- [x] IC / OOC chat (mesaj gönder / al)
- [x] `dice:roll` → `rpg-dice-roller` → sonucu broadcast
- [x] `chat_messages`, `dice_rolls` tabloları + persistence
- [x] Session ekranı basic layout (3 kolon desktop)
- [x] CORS konfigürasyonu (Vercel ↔ Railway)
- [x] Socket token endpoint (`/api/socket/token`)
- [x] `prisma migrate dev` — Sprint 3 migration'ı Supabase'e uygula

---

## Sprint 4 — Detay

**Hedef:** Karakter sayfası + görünürlük sistemi.

- [x] `characters` tablosu (public_data, private_data jsonb)
- [x] `character_stats`, `character_wallet` tabloları
- [x] `GET/PATCH /api/characters/[id]` — sahip + GM yetkisi
- [x] Görünürlük middleware: `is_public` stat filtresi
- [x] `character:update` / `character:update_private` socket events
- [x] `/character/[id]` sayfası — sheet, stats
- [x] Oyun odasında oyuncu kartları (HP/Mana public gösterim)
- [x] `POST /api/characters` — karakter oluşturma (default stats + wallet)
- [x] `prisma migrate dev` — Sprint 4 migration'ı Supabase'e uygula

---

## Sprint 5 — Detay

**Hedef:** Gameset editörü + skill-tree-based stat sistemi + karakter wizard.

> **Kilit karar:** Tüm stat değerleri skill tree'den türetilir. Point-buy yoktur. Class seçimi class skill tree'ye erişim verir, common tree herkese açıktır.

### Veritabanı

- [x] `stat_groups`, `stat_definitions` tabloları (BASE/DERIVED/RESOURCE tipleri)
- [x] `classes`, `subclasses`, `races` tabloları (stat_bonuses yok, trait bazlı)
- [x] `skill_tree_nodes` tablosu (max_level, cost_per_level, stat_bonuses_per_level)
- [x] `character_skill_unlocks` tablosu (current_level)
- [x] `character_approval_requests` tablosu

### Skill Tree Editörü (GM)

- [x] `@xyflow/react` canvas entegrasyonu
- [x] Class tree / Common tree seçici
- [x] Node editörü: tip, ad, max_level, cost_per_level, stat_bonuses_per_level, prerequisites
- [x] DFS cycle detection (editör + sunucu)

### Ruleset Editörü UI

- [x] Genel / Stat Tanımları / Sınıf-Irk / Skill Ağacı / Büyüler / Eşyalar sekmeleri
- [x] DERIVED stat formula builder (görsel)
- [x] Gameset config: starting_skill_points, skill_points_per_level

### Karakter Wizard

- [x] 5 adım: race → class → **skill dağıtımı** → detaylar → özet
- [x] Adım 3: Class tree + Common tree üzerinde starting_skill_points dağıtımı
- [x] Anlık stat önizlemesi (skill seçimlerine göre hesaplanır)
- [x] GM onay paneli (Onayla / Reddet)

### Oyuncu Skill Tree

- [x] Salt-okunur skill tree görünümü + unlock/level-up butonu
- [x] Level atlama → skill point kazanımı
- [x] Skill unlock/level-up → character_stats.base_value cache güncelleme

---

## Sprint 6 — Detay

**Hedef:** Grid inventory + eşya sistemi.

- [x] `item_definitions` tablosu
- [x] `character_inventory` tablosu
- [x] Grid inventory UI (EFT tarzı, drag-drop)
- [x] Eşya formu: ad, kategori, grid_w × grid_h, equipment_slot, stat_bonuses, stackable
- [x] Server-side çakışma algoritması
- [x] Equip/unequip → `character_stats.current_value` güncelleme
- [x] `inv:move`, `inv:equip`, `inv:drop`, `gm:item_add` socket events

---

## Sprint 7 — Detay

**Hedef:** Büyü sistemi tamamlanması.

- [x] `spells`, `character_spells` tabloları
- [x] Gameset büyü editörü sekmesi
- [x] `char:use_spell` socket event
- [x] Mana tüketimi + slot yönetimi
- [x] Oyuncu spell listesi UI (slot atama)
- [x] SPELL_UNLOCK node → otomatik büyü ekleme

---

## Sprint 8+ — v1 Polishing

**Hedef:** Üretim kalitesinde ilk sürüm.

### UI / UX

- [x] Dark fantasy tema (Cinzel font, gold/dark color palette)
- [x] Mobile-first responsive layout (4 sekme)
- [x] Tüm ekranlar için loading/error state'leri
- [x] Toast bildirimleri sistemi
- [x] Karakter detayları artık sağ panelde (zar kısmı) değil, ortadaki ana alanda gösteriliyor
- [x] Zar paneli her zaman sağ sidebar'da sabit — karakter detayı açıldığında kaybolmuyor
- [x] Ortadaki ana alan scroll düzeltmesi (flexbox min-h-0 fix)

### Mağaza Sistemi

- [x] `stores`, `store_items`, `pending_transactions` tabloları (DB schema + migration)
- [x] Mağaza UI — GM, session odasında "Mağaza" butonundan mağaza presetleri oluşturur (maks. 6 ürün), fiyat atar, aktifleştirir. Oyunculara socket bildirimi gider.
- [x] Transaction onay akışı: oyuncu fiyat teklifi verir → GM onaylar/reddeder (socket real-time) → onayda altın düşer, eşya envantere eklenir.
- [x] Ekonomi güvenlik kontrolleri — Dinamik para birimi sistemi (GM tanımlı), JSON wallet balances, eşya fiyatlandırma, oyuncular arası para transferi (istek/kabul/ret), mağaza dinamik para birimi desteği

### Envanter Sistemi

- [x] Kullanıcıların kendi envanterlerini grid sisteminde görüntülemesi ve griddeki konumlarını düzenleyebilmesi. (Session odasında CharacterDetailPanel içinde InventoryPanel, karakter sayfasında da gösterildi)

- [x] Kullanıcılara eklenen eşyaların, grid envanter sistemine uygun eklenmesi (GM, oyuncu detayları kısmından eşya verebiliyor; eşya grid'e uygun formatta ekleniyor)

- [x] Kullanıcıların envanterlerinin kapasitesinin stata bağlanabilmesi. (Ruleset oluşturulurken
      Gm isterse önceden belirlenmiş, isterse de oluşturulan statlara bağlı dinamik bir yapıda sunması. Eğer dinamik ise de kullanıcının stat dağıtmasının ardındna envanter boyutunun refresh olması.) (`inventoryCapacityStat` + `inventoryCapacityRowsPerPoint` gameset config'e eklendi)

- [x] Envanter sisteminde tamamen EFT, Unturned gibi sistemlerden ilham alınacak olup yönetimi de aynı şekilde olacaktır.

- [x] Oyun içi loot bulunması takdirinde envanterin altında (lootables) alanından eşyalar "Al" butonu ile alınacak. GM loot havuzuna eşya ekler, oyuncular kendi karakter panellerinden alır. (Drag-drop yerine buton tabanlı; socket ile real-time)

### Export & Cron

- [ ] `GET /api/characters/[id]/export` endpoint
- [ ] Grace period UI (banner + dashboard badge)
- [ ] Vercel Cron Job: `/api/cron/cleanup-sessions` (günlük)
- [ ] Resend e-posta: session kapanma bildirimleri (gün 0 + gün 5)

### Admin & Operasyonel

- [ ] `/admin/users` — kullanıcı yönetimi
- [ ] GM rolü atama/kaldırma
- [ ] Rate limiting (export endpoint)
- [ ] Loglama (GM socket event bypass denemeleri)

---

## v2 Backlog (MVP Sonrası)

| Özellik                    | Notlar                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| Skill respec sistemi       | Kısmi veya tam sıfırlama mekanizması; stat cache yeniden hesaplama |
| Redis entegrasyonu         | Socket.io server restart'ta state koruma                           |
| Karakter import            | Export JSON'dan karakter yükleme                                   |
| Çoklu GM desteği           | Prototipte tek GM; v2'de birden fazla                              |
| NPC sistemi                | GM'in yönettiği NPC karakterler                                    |
| Battle map                 | Grid tabanlı savaş haritası                                        |
| Oyun notları / session log | GM notları sayfası                                                 |
| Discord entegrasyonu       | Zar sonucu + session bildirimleri                                  |
| Mobil uygulama             | React Native veya PWA                                              |

---

## Teknik Borç ve Riskler

| Risk                                      | Önlem                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Vercel serverless + Socket.io uyumsuzluğu | Socket.io ayrı Railway servisi olarak çalışıyor — çözüldü                      |
| Redis yokken session state kaybı          | MVP'de ~2-5sn restart toleransı kabul edildi; v2'de Redis                      |
| Supabase ücretsiz tier limitleri          | Prototip için yeterli; büyümede Supabase Pro geçişi                            |
| `@xyflow/react` learning curve            | MIT lisanslı, iyi dokümante; Sprint 5'te skill tree editörü ile birlikte gelir |
| DERIVED stat formula sonsuz döngü         | Formula recursive jsonb; evaluator stack overflow koruması gerekli             |
| Skill tree stat cache tutarsızlığı        | Her skill unlock/level-up tek transaction'da base_value yeniden hesaplanır     |
| Skill tree balans                         | Class tree ucuz, common tree pahalı prensibi; GM test araçları gerekebilir     |

---

# UZATMA SPRINTLERI

### Sprint 9 — Savaş & İnisiyatif Sistemi (GM Perspektifi: P0)

**Hedef:** Masa başı savaşı dijitalde yönetebilmek. Şu an karakter ve eşya var ama "savaş döndürme" mekanizması yok.

#### Action Log

Bir tuşa basınca açılan ve chat loglarının yanında sekmesi açılan combat log sekmesi. Sadece GM mesaj gönderebilir.

- [x] Kronolojik combat log paneli (kim kime ne kadar hasar verdi/iyileştirdi/buff'ladı)
- [x] Filtre: Oyuncu bazlı

---

### Sprint 10 — Durum Efektleri (Conditions) & Dinlenme

**Hedef:** Buff/debuff, "zehirlendi", "sersemletildi" gibi geçici efektler ve oturum içi yenileme.

#### Conditions

- [ ] `condition_definitions` tablosu (gameset düzeyinde: ad, ikon, açıklama, stat modifikatörleri, aksiyon kısıtlamaları)
- [ ] `character_conditions` tablosu (active, remainingDuration, source, stacks)
- [ ] Karakter kartında condition rozetleri (hover ile detay)
- [ ] GM toplu uygulama (encounter'da seçili hedeflere)
- [ ] Round/tur bazlı otomatik süre azaltma (combat sistemi ile entegre)
- [ ] Condition tetikli stat değişimi (mevcut stat hesaplama pipeline'ına entegre)

---

### Sprint 11 — XP, Quest & Lore Sistemi

#### Quest Tracker

- [ ] `quests` tablosu (sessionId, title, description, status, rewards JSON, hiddenObjectives)
- [ ] Quest log UI (aktif / tamamlanmış / başarısız sekmeleri)
- [ ] Hidden objective: oyuncuya görünmez, sadece GM bilir, tamamlanınca reveal
- [ ] Quest oluştururken queste ait ödül tablosunun belirlenmesi ve quest durumunun gm tarafından değiştirilmesi. Tamamlanması durumunda ödüllerin dağıtılması

#### Lore / Codex / Wiki

- [ ] `lore_entries` tablosu (sessionId, title, body markdown, visibility: GM_ONLY / PLAYERS / SPECIFIC_PLAYERS)
- [ ] Codex sayfası (oyuncular kendi öğrendikleri lore'u görür)
- [ ] Handout sistemi: GM görsel/doküman paylaşır, oyuncuya bildirim gider
- [ ] Faction & Reputation tracker (gameset config'te tanımlı, karakter başına her bir factiona ait reputation skoru sistemi. Faction sayısı 0 veya daha fazla olabilir ve her factionun kendine ait rep değeri bulunur. Rep değeri manuel olarak girilir.)

---

### Sprint 14 — Karakter & İletişim Genişletmeleri

#### Karakter

- [ ] Karakter portresi / token image upload (asset sistemi)
- [ ] Bilinen diller (`character.languages` + gameset language list)
- [ ] Dile özel chat: "Sadece Elfçe konuşanlar görür" mesajları
- [ ] Karakter ilişkileri / bonds (narrative tracker, NPC ve diğer PC'lerle)
- [ ] Kişisel notlar (oyuncunun kendi özel notları, GM bile göremez)
- [ ] Karakter biyografisi / arka plan alanı (markdown)

- [ ] Gamesette, karakterlere özel statlar ekleyebilme (örn, bir oyun setinde her karakterin ekstra ilham seviyesi bulunur. Bu değerler int belirlenir ve gamesete bağlıdır. İstendiği miktarda Custom Stat eklenebilir, Custom statlar ile normal statlar aynı tabloda yer almaz, custom statlar kendilerine ait bir alandır)

---

## Teknik Olgunluk & Operasyonel Eksikler (Senior Dev Perspektifi)

> Mevcut kod çalışıyor ama prodüksiyona uzun ömürlü taşıma için aşağıdaki teknik borçların kapatılması gerekir.

### A. Test & Kalite

- [ ] Vitest birim test altyapısı (stat hesaplama, formula evaluator, inventory grid çakışma, fiyat sanitize)
- [ ] Playwright E2E senaryoları: login → session oluştur → karakter wizard → zar at → mağaza alışverişi
- [ ] Socket entegrasyon testleri (mock client + gerçek server)
- [ ] CI: GitHub Actions (lint + typecheck + test pipeline, PR başına)
- [ ] Pre-commit hook (husky + lint-staged): commit öncesi format/typecheck

### B. Observability & Hata Yönetimi

- [ ] Yapılandırılmış loglama (pino) — Next.js + socket server
- [ ] Sentry entegrasyonu (FE + BE + socket server)
- [ ] Performance metrikleri: API response time, socket event latency
- [ ] `/api/health` + socket health endpoint (uptime monitor için)
- [ ] Audit log: GM'in destructive aksiyonları (item silme, karakter reddetme, session sıfırlama)
- [ ] Uptime monitoring (UptimeRobot / Healthchecks.io)

### C. Güvenlik Sertleştirme

- [ ] Genel rate limiting (Nginx `limit_req` veya Upstash) — login, register, dice, socket event throttle
- [ ] Tüm API + socket için Zod input şeması (şu an manuel kontroller var)
- [ ] CSRF doğrulama audit (NextAuth varsayılan korumalarını test et)
- [ ] Socket event yetki denetimi audit + bypass deneme loglama
- [ ] Şifre sıfırlama akışı (Resend mail token)
- [ ] 2FA opsiyonel (TOTP, GM hesapları için zorunlu seçeneği)
- [ ] Güçlü şifre politikası + brute-force koruması (login)
- [ ] Nginx security headers: CSP, HSTS, X-Frame-Options, Referrer-Policy
- [ ] Karakter görünürlük middleware penetrasyon testi (private_data leak kontrolü)

### D. Veri & Performans

- [ ] DB index audit (`chat_messages.sessionId+createdAt`, `dice_rolls.sessionId`, `character_stats.characterId` vb.)
- [ ] Pagination: chat history, dice history, session listesi (şu an full load)
- [ ] Soft delete + recovery (kazara silinen karakter/session geri yükleme)
- [ ] Optimistic locking: karakter sheet eşzamanlı düzenlemede `version` field
- [ ] N+1 query audit (özellikle `session/[id]/page.tsx` büyük include zinciri)
- [ ] DB backup stratejisi: cron tabanlı pg_dump + offsite kopya (Backblaze B2 / R2)
- [ ] `prisma migrate deploy` üretimde (`db push` yerine, schema versiyonlaması için)

### E. Asset / Dosya Yönetimi (Şu an Eksik!)

- [ ] Görsel upload servisi: item icon, karakter portresi, battle map, handout
- [ ] Storage backend seçimi: Cloudflare R2 / Backblaze B2 (S3-uyumlu) veya VPS lokal + Nginx serve
- [ ] Görsel optimizasyon: sharp ile thumbnail + WebP dönüşüm
- [ ] Upload doğrulama: MIME type, dosya boyutu, virus tarama (ClamAV opsiyonel)
- [ ] CDN katmanı (büyürse Cloudflare ücretsiz tier)

### F. Real-time Sağlamlığı

- [ ] Socket reconnect + event replay (server'da event kuyruğu, client reconnect'te kaçırılanları gönder)
- [ ] Presence sistemi: kim online, kim chat'e yazıyor (typing indicator)
- [ ] Redis adapter (v2 backlog'dan öne alınmalı: multi-instance + restart toleransı)
- [ ] Socket event versiyonlama (geriye dönük uyumluluk için)

### G. Erişilebilirlik & i18n

- [ ] a11y audit: klavye navigasyon, ARIA labels, kontrast oranı (WCAG AA)
- [ ] i18n string extraction tamamlanması (mevcut locale-switcher var, string coverage düşük)
- [ ] Çok dilli gameset içerik desteği (item/skill adları, opsiyonel)

### H. Deploy & DevOps

- [ ] CI/CD pipeline: GitHub Actions → SSH deploy (manual deploy yerine)
- [ ] PM2 log rotation (`pm2-logrotate`)
- [ ] Nginx erişim/hata logu rotasyonu
- [ ] DB backup cron job + restore drill prosedürü
- [ ] Staging ortamı (test branch için ayrı subdomain)
- [ ] Environment variable yönetimi (`.env` yerine Doppler / Vault opsiyonu)

### I. UX İnce Ayarlar

- [ ] Virtual scroll uzun listelerde (chat history, eşya kataloğu, skill tree büyük gameset'lerde)
- [ ] Onboarding tour (yeni GM/oyuncu için interaktif tutorial)
- [ ] Anlamlı empty state'ler (CTA ile, "henüz mağaza yok — oluştur" tarzı)
- [ ] Klavye kısayolları (zar atma, panel toggle, sonraki tur)
- [ ] Undo/redo skill tree editöründe
- [ ] Karakter sheet otomatik kaydetme indikatörü ("kaydedildi" / "kaydediliyor" durumu)
- [ ] Konum saklama: GM panelinde son açık sekme, inventory'de son scroll

---

## Öncelik Önerisi

| Öncelik  | Sprint Aralığı | Açıklama                                                        |
| -------- | -------------- | --------------------------------------------------------------- |
| **P0**   | Sprint 9-10    | Savaş, initiative, conditions, rest — TTRPG'nin olmazsa olmazı  |
| **P1**   | Sprint 11-13   | XP, quest, NPC, battle map — gerçek kampanya yönetimi           |
| **P1.5** | Teknik A-D     | Test, observability, güvenlik, performans — prod stabilitesi    |
| **P2**   | Sprint 14-16   | İletişim genişletmeleri, GM tools, crafting — GM kalite-of-life |
| **P3**   | Teknik E-I     | Asset, real-time sağlamlık, a11y, UX — uzun vadeli olgunluk     |
