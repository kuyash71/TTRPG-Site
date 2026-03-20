# TTRPG Oyun Yönetim Sitesi — Roadmap

> Son güncelleme: 2026-03

---

## Sprint Planı

| Sprint | Odak | Teslim Edilecekler |
|---|---|---|
| **Sprint 1** | Temel altyapı | Next.js 14 App Router kurulumu, Prisma + Supabase bağlantısı, NextAuth email/password provider, kullanıcı rolleri (USER/GM/ADMIN), temel User CRUD |
| **Sprint 2** | Session sistemi | Session oluşturma, `invite_code` üretimi, `/join/[invite_code]` akışı, session durum yönetimi (OPEN → ACTIVE → CLOSING → CLOSED) |
| **Sprint 3** | Gerçek zamanlı | Socket.io server (Railway), room sistemi, IC/OOC chat, zar atma (`rpg-dice-roller`), event broadcast altyapısı |
| **Sprint 4** | Karakter sistemi | Character sheet CRUD, public/private veri ayrımı, görünürlük middleware, anlık güncelleme (socket events) |
| **Sprint 5** | Gameset temel | Stat/attribute tanımları ve grupları, class/race sistemi, karakter oluşturma wizard'ı (5 adım), GM onay akışı, temel inventory |
| **Sprint 6** | Skill tree | Node-based editör (`@xyflow/react`), ön koşul sistemi, DFS cycle detection, puan hesaplama, görsel ağaç render |
| **Sprint 7** | Büyü sistemi | Spell tanımları, slot sistemi, `char:use_spell` event, mana tüketimi, gameset büyü editörü |
| **Sprint 8+** | Polishing & v1 | Dark fantasy UI (Tailwind), mobile optimizasyon, GM panel genişletme, admin dashboard, export sistemi, e-posta bildirimleri (Resend), Vercel Cron cleanup |

---

## Sprint 1 — Detay

**Hedef:** Çalışan auth + temel DB şeması + rol sistemi.

- [ ] Next.js 14 App Router projesi oluştur
- [ ] Prisma + Supabase PostgreSQL bağlantısı kur
- [ ] `users` tablosunu migrate et (id, email, password_hash, username, role)
- [ ] NextAuth credential provider (email/password, bcrypt)
- [ ] JWT içine `role` ekle
- [ ] Rol middleware (`withRole` wrapper)
- [ ] `/register`, `/login`, `/dashboard` sayfaları (bare minimum UI)
- [ ] Environment variables Vercel'e yükle

---

## Sprint 2 — Detay

**Hedef:** GM session oluşturabilir, oyuncu davet koduyla katılabilir.

- [ ] `sessions`, `session_players` tabloları
- [ ] `gamesets` tablosu (basit, config olmadan)
- [ ] `POST /api/sessions` — GM session oluşturur, invite_code üretilir
- [ ] `GET /join/[invite_code]` — oyuncu session'a katılır
- [ ] Session durum geçişleri (OPEN → ACTIVE → CLOSING → CLOSED)
- [ ] GM dashboard: session listesi + yeni session butonu
- [ ] Oyuncu dashboard: katıldığı session'lar listesi

---

## Sprint 3 — Detay

**Hedef:** Canlı oyun odası — chat + zar.

- [ ] Ayrı Node.js Socket.io server (Railway deploy)
- [ ] Room sistemi: `session:join` / `session:leave`
- [ ] IC / OOC chat (mesaj gönder / al)
- [ ] `dice:roll` → `rpg-dice-roller` → sonucu broadcast
- [ ] `chat_messages`, `dice_rolls` tabloları + persistence
- [ ] Session ekranı basic layout (3 kolon desktop)
- [ ] CORS konfigürasyonu (Vercel ↔ Railway)

---

## Sprint 4 — Detay

**Hedef:** Karakter sayfası + görünürlük sistemi.

- [ ] `characters` tablosu (public_data, private_data jsonb)
- [ ] `character_stats`, `character_wallet` tabloları
- [ ] `GET/PATCH /api/characters/[id]` — sahip + GM yetkisi
- [ ] Görünürlük middleware: `is_public` stat filtresi
- [ ] `character:update` / `character:update_private` socket events
- [ ] `/character/[id]` sayfası — sheet, stats
- [ ] Oyun odasında oyuncu kartları (HP/Mana public gösterim)

---

## Sprint 5 — Detay

**Hedef:** Tam gameset editörü + karakter wizard.

- [ ] `stat_groups`, `stat_definitions` tabloları
- [ ] `classes`, `subclasses`, `races` tabloları
- [ ] `item_definitions` tablosu
- [ ] `character_inventory` tablosu
- [ ] Ruleset editörü UI: Genel / Stat Grupları / Sınıf-Irk / Eşyalar sekmeleri
- [ ] DERIVED stat formula builder (görsel)
- [ ] Karakter wizard 5 adım (race → class → stats → detaylar → özet)
- [ ] `character_approval_requests` tablosu
- [ ] GM onay paneli (Onayla / Reddet)
- [ ] Grid inventory UI (EFT tarzı, drag-drop)
- [ ] Server-side çakışma algoritması

---

## Sprint 6 — Detay

**Hedef:** Skill tree editörü ve oyuncu deneyimi.

- [ ] `skill_tree_nodes`, `character_skill_unlocks` tabloları
- [ ] `@xyflow/react` canvas entegrasyonu
- [ ] Node editörü (PASSIVE/ACTIVE/SPELL_UNLOCK)
- [ ] DFS cycle detection (editör + sunucu)
- [ ] Level atlama → skill point kazanımı
- [ ] Oyuncu skill tree görünümü (salt-okunur + unlock butonu)

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

| Özellik | Notlar |
|---|---|
| Redis entegrasyonu | Socket.io server restart'ta state koruma |
| Karakter import | Export JSON'dan karakter yükleme |
| Çoklu GM desteği | Prototipte tek GM; v2'de birden fazla |
| NPC sistemi | GM'in yönettiği NPC karakterler |
| Battle map | Grid tabanlı savaş haritası |
| Oyun notları / session log | GM notları sayfası |
| Discord entegrasyonu | Zar sonucu + session bildirimleri |
| Mobil uygulama | React Native veya PWA |

---

## Teknik Borç ve Riskler

| Risk | Önlem |
|---|---|
| Vercel serverless + Socket.io uyumsuzluğu | Socket.io ayrı Railway servisi olarak çalışıyor — çözüldü |
| Redis yokken session state kaybı | MVP'de ~2-5sn restart toleransı kabul edildi; v2'de Redis |
| Supabase ücretsiz tier limitleri | Prototip için yeterli; büyümede Supabase Pro geçişi |
| `@xyflow/react` learning curve | MIT lisanslı, iyi dokümante; spike sprint'te denenecek |
| DERIVED stat formula sonsuz döngü | Formula recursive jsonb; evaluator stack overflow koruması gerekli |
