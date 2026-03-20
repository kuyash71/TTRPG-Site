# TTRPG Oyun Yönetim Sitesi

Web tabanlı, kişisel fantastik evren odaklı TTRPG yönetim platformu. GM ve oyuncular gerçek zamanlı olarak aynı masada buluşur: karakter oluşturma, zar atma, envanter yönetimi ve mağaza sistemi tek bir arayüzde.

---

## Özellikler

- **Session Yönetimi** — GM davet kodu üretir, oyuncular `/join/[code]` ile katılır
- **Gerçek Zamanlı Oyun Odası** — Socket.io tabanlı chat (IC/OOC), zar atma, canlı güncellemeler
- **Özelleştirilebilir Ruleset Editörü** — Stat grupları, sınıf/ırk, skill tree, büyüler, eşyalar; GM her şeyi görsel editörle tanımlar
- **EFT Tarzı Grid Inventory** — Sürükle-bırak, döndürme, slot bazlı ekipman yönetimi
- **Mağaza ve Ekonomi** — GM onaylı alım/satım, hiyerarşik para birimi sistemi, atomik transaction
- **Karakter Wizard** — 5 adımlı oluşturma akışı + GM onay mekanizması
- **Skill Tree** — Node-based görsel editör, ön koşul sistemi, büyü unlock
- **Karakter Export** — Session kapandıktan sonra 7 günlük grace period + JSON export

---

## Teknik Stack

| Katman | Teknoloji |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| ORM | Prisma |
| Veritabanı | PostgreSQL (Supabase) |
| Gerçek zamanlı | Socket.io (Railway) |
| Auth | NextAuth.js (email/password) |
| Dosya depolama | Supabase Storage |
| Skill tree | @xyflow/react |
| Dice parser | rpg-dice-roller |
| E-posta | Resend |
| Stil | Tailwind CSS |
| Cron | Vercel Cron Jobs |

---

## Mimari Özeti

```
Browser ──HTTP──▶ Next.js (Vercel)
                    │ Prisma
                    ▼
               PostgreSQL (Supabase)
                    │
Browser ──WS──▶ Socket.io Server (Railway)
                    │ Prisma
                    ▼
               PostgreSQL (Supabase)
```

- **Next.js** API Routes: REST endpoint'ler, NextAuth, Vercel Cron
- **Socket.io server**: Ayrı Railway servisi — gerçek zamanlı event bus
- **Supabase**: PostgreSQL + Dosya depolama (avatar, ikon)

Daha fazlası için → [docs/architecture.md](docs/architecture.md)

---

## Başlangıç

### Gereksinimler

- Node.js 18+
- PostgreSQL (veya Supabase hesabı)
- Railway veya Render hesabı (Socket.io server için)

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local içini doldur (DATABASE_URL, NEXTAUTH_SECRET, vb.)

# Veritabanı migration
npx prisma migrate dev

# Geliştirme sunucusu
npm run dev
```

### Ortam Değişkenleri

```env
# Next.js / Vercel
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
CRON_SECRET=...
RESEND_API_KEY=...
```

Socket.io sunucusu için Railway ortam değişkenleri ayrıca tanımlanır. Detaylar: [docs/architecture.md#3-hosting-ve-ortam-değişkenleri](docs/architecture.md#3-hosting-ve-ortam-değişkenleri)

---

## Dokümantasyon

| Döküman | Açıklama |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Tam mimari döküman: DB şeması, Socket events, sistem kararları |
| [docs/roadmap.md](docs/roadmap.md) | Sprint planı ve v1 yol haritası |
| [docs/api.md](docs/api.md) | API endpoint referansı |

---

## Proje Durumu

Sprint 1'e hazır. Tüm mimari kararlar kesinleşti.

Yol haritası için → [docs/roadmap.md](docs/roadmap.md)
