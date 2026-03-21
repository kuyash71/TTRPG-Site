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

- [ ] `item_definitions` tablosu
- [ ] `character_inventory` tablosu
- [ ] Grid inventory UI (EFT tarzı, drag-drop)
- [ ] Eşya formu: ad, kategori, grid_w × grid_h, equipment_slot, stat_bonuses, stackable
- [ ] Server-side çakışma algoritması
- [ ] Equip/unequip → `character_stats.current_value` güncelleme
- [ ] `inv:move`, `inv:equip`, `inv:drop`, `gm:item_add` socket events

---

## Sprint 7 — Detay

**Hedef:** Büyü sistemi tamamlanması.

- [ ] `spells`, `character_spells` tabloları
- [ ] Gameset büyü editörü sekmesi
- [ ] `char:use_spell` socket event
- [ ] Mana tüketimi + slot yönetimi
- [ ] Oyuncu spell listesi UI (slot atama)
- [ ] SPELL_UNLOCK node → otomatik büyü ekleme

---

## Sprint 8+ — v1 Polishing

**Hedef:** Üretim kalitesinde ilk sürüm.

### UI / UX

- [ ] Dark fantasy tema (Cinzel font, gold/dark color palette)
- [ ] Mobile-first responsive layout (4 sekme)
- [ ] Tüm ekranlar için loading/error state'leri
- [ ] Toast bildirimleri sistemi

### Mağaza Sistemi

- [ ] `stores`, `store_items`, `session_store_state`, `pending_transactions` tabloları
- [ ] Mağaza UI — GM panel entegrasyonu
- [ ] Transaction onay akışı (buy + sell)
- [ ] Ekonomi güvenlik kontrolleri (SELECT FOR UPDATE)

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
