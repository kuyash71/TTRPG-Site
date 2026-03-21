# TTRPG Oyun Yönetim Sitesi — Mimari Döküman

> **Durum:** Sprint 1'e hazır — tüm mimari kararlar kesinleşti

---

## İçindekiler

1. [Proje Özeti](#1-proje-özeti)
2. [Teknik Stack](#2-teknik-stack)
3. [Hosting ve Ortam Değişkenleri](#3-hosting-ve-ortam-değişkenleri)
4. [Veritabanı Şeması](#4-veritabanı-şeması)
5. [Kullanıcı Rolleri ve Yetki Sistemi](#5-kullanıcı-rolleri-ve-yetki-sistemi)
6. [Gerçek Zamanlı Sistem — Socket.io Event Haritası](#6-gerçek-zamanlı-sistem--socketio-event-haritası)
7. [Ruleset Editörü](#7-ruleset-editörü)
8. [Karakter Oluşturma Akışı](#8-karakter-oluşturma-akışı)
9. [Grid Inventory Sistemi](#9-grid-inventory-sistemi)
10. [Ekonomi ve Mağaza Sistemi](#10-ekonomi-ve-mağaza-sistemi)
11. [Oyun Odası Layout](#11-oyun-odası-layout)
12. [Görünürlük Kuralları](#12-görünürlük-kuralları)
13. [Gameset Versiyon Sistemi](#13-gameset-versiyon-sistemi)
14. [Karakter Yaşam Döngüsü ve Export](#14-karakter-yaşam-döngüsü-ve-export)
15. [Edge Case'ler ve Hata Senaryoları](#15-edge-caseler-ve-hata-senaryoları)
16. [Sayfa Yapısı ve Rotalar](#16-sayfa-yapısı-ve-rotalar)

---

## 1. Proje Özeti

Kişisel bir fantastik evren için web tabanlı TTRPG oyun yönetim sitesi. GM (tek kişi, prototipte) oyuncularına `invite_code` ile session davetiyesi gönderir. Oyuncular hesap oluşturup session'a katılır. Her session için bir **gameset** (kural seti) atanır; GM bu gameset'i görsel editörle tamamen özelleştirebilir.

**Temel özellikler:**

- Session yönetimi ve gerçek zamanlı oyun odası
- Tamamen özelleştirilebilir ruleset editörü (stat, sınıf, skill tree, büyü, eşya)
- EFT tarzı grid inventory sistemi
- GM onaylı mağaza ve ekonomi sistemi
- Karakter oluşturma wizard'ı ve GM onay akışı
- Mobil öncelikli, dark fantasy teması

---

## 2. Teknik Stack

| Katman | Teknoloji | Gerekçe |
|---|---|---|
| Frontend + API | **Next.js 14** (App Router) | React bilgisi direkt geçer, SSR, API Routes ile ayrı backend gerekmez |
| ORM | **Prisma** | Type-safe sorgular, migration yönetimi, PostgreSQL ile mükemmel uyum |
| Veritabanı | **PostgreSQL** (Supabase hosted) | İlişkisel veri, JSONB desteği, Row Level Security |
| Gerçek zamanlı | **Socket.io** (ayrı Node.js server) | Vercel serverless persistent connection tutamaz; Railway/Render'da ayrı servis |
| Auth | **NextAuth.js** | Email/password credential provider, JWT, rol middleware |
| Dosya depolama | **Supabase Storage** | DB ile aynı platform, avatar ve item ikonları için |
| Skill tree editörü | **@xyflow/react** | MIT lisanslı, node-based editör (React Flow'un yeni paket adı) |
| Dice parser | **rpg-dice-roller** | 2d6+3, 4d6kh3 formatları, MIT lisanslı npm paketi |
| E-posta | **Resend** | Grace period bildirimleri, 100 e-posta/gün ücretsiz, Vercel native |
| Stil | **Tailwind CSS** | |
| Cron | **Vercel Cron Jobs** | Grace period temizleme işi (ücretsiz, günlük) |

> **Not:** Redis MVP'de yok. Socket.io server restart'ta state kaybı tolere edilir. v2'de eklenecek.

---

## 3. Hosting ve Ortam Değişkenleri

### Hosting

| Servis | Platform | Plan |
|---|---|---|
| Next.js uygulaması | **Vercel** | Hobby (ücretsiz); ticari geçişte Pro ($20/ay) |
| Socket.io server | **Railway** veya **Render** | Ücretsiz tier |
| PostgreSQL | **Supabase** | Ücretsiz tier |
| Dosya depolama | **Supabase Storage** | Ücretsiz tier |

### Environment Variables

**Next.js — Vercel:**
```
NEXTAUTH_URL
NEXTAUTH_SECRET
DATABASE_URL
NEXT_PUBLIC_SOCKET_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
CRON_SECRET
RESEND_API_KEY
```

**Socket.io Server — Railway:**
```
PORT
DATABASE_URL
CORS_ORIGINS          # Vercel domain(ler)i
JWT_SECRET            # NextAuth ile aynı secret
```

**Socket.io CORS Konfigürasyonu:**
```js
{
  origin: [process.env.CORS_ORIGINS],
  methods: ["GET", "POST"],
  credentials: true
}
```

> **Kritik:** Socket.io ve Next.js farklı domain'lerde çalışır. `CORS_ORIGINS` Railway env'de, `NEXT_PUBLIC_SOCKET_URL` Vercel env'de tanımlı olmalı.

---

## 4. Veritabanı Şeması

### 4.1 Kullanıcılar

```sql
users
  id              uuid PK
  email           text UNIQUE
  password_hash   text
  username        text UNIQUE
  role            ENUM(USER, GM, ADMIN)
  created_at      timestamptz
```

### 4.2 Session'lar

```sql
sessions
  id                      uuid PK
  invite_code             text UNIQUE
  gm_id                   → users.id
  gameset_id              → gamesets.id   -- hangi versiyona bağlı
  name                    text
  status                  ENUM(OPEN, ACTIVE, CLOSING, CLOSED)
  closed_at               timestamptz nullable
  created_at              timestamptz

-- NOT: gameset_snapshot KALDIRILDI.
-- Versiyon sistemi bu ihtiyacı ortadan kaldırdı.
-- Session doğrudan bir gameset versiyonuna (satırına) bağlanır.

session_players
  id          uuid PK
  session_id  → sessions.id
  user_id     → users.id
  joined_at   timestamptz
  UNIQUE(session_id, user_id)
```

### 4.3 Gameset ve Versiyon Sistemi

```sql
gamesets
  id                uuid PK
  name              text
  description       text
  version           integer DEFAULT 1
  parent_gameset_id → gamesets.id nullable  -- v1'den v2 türediyse parent=v1
  is_published      boolean
  created_by        → users.id
  created_at        timestamptz
  config            jsonb
  -- config şeması:
  -- {
  --   max_level: 20,
  --   starting_skill_points: 5,         -- karakter oluşturmada verilen ilk skill puanı
  --   skill_points_per_level: 2,        -- her level'da kazanılan skill puanı
  --   inventory_cols: 12,
  --   inventory_rows: 10,
  --   equipment_slots: ["head","chest","hands","legs","feet","weapon_main","weapon_off","ring1","ring2","neck"],
  --   currency_units: [...],
  --   alignments: [{ key:"LG", label:"Kural İyisi" }, ...],
  --   mana_label: "Mana"
  -- }
  -- NOT: starting_points ve point_buy_costs KALDIRILDI.
  -- Stat dağıtımı artık skill tree üzerinden yapılır.
```

### 4.4 Stat Sistemi (Skill-Tree-Based)

> **Temel tasarım kararı:** Oyuncular doğrudan stat puanı dağıtmaz. Tüm stat değerleri skill tree ilerlemesinden türetilir. Bu, class seçimini anlamlı kılar ve "skill tree = stat kaynağı" bütünlüğünü sağlar.

```sql
stat_groups
  id          uuid PK
  gameset_id  → gamesets.id
  name        text         -- "Savaş Statları"
  icon        text
  sort_order  integer

stat_definitions
  id          uuid PK
  gameset_id  → gamesets.id
  group_id    → stat_groups.id
  key         text         -- "STR"
  label       text         -- "Güç"
  type        ENUM(BASE, DERIVED, RESOURCE)
  max_val     integer nullable   -- opsiyonel tavan (GM belirler)
  formula     jsonb nullable     -- sadece DERIVED için
  is_public   boolean
  sort_order  integer

-- formula jsonb şeması (recursive):
-- { op: "add"|"subtract"|"multiply"|"divide"|"floor"|"ceil"|"min"|"max",
--   operands: [ { type:"stat", key:"CON" } | { type:"const", value:10 } | { type:<op> } ]
-- }
-- Örnek HP = CON × level + 10:
-- { op:"add", operands:[
--     { op:"multiply", operands:[{type:"stat",key:"CON"},{type:"stat",key:"level"}] },
--     {type:"const",value:10}
--   ]
-- }
```

**Stat tipleri:**
- `BASE` — Değeri tamamen skill tree bonuslarının toplamından gelir. Oyuncu doğrudan değer atamaz.
- `DERIVED` — Formula'dan hesaplanır (diğer stat'lara bağlı), DB'ye **yazılmaz**; her okumada hesaplanır
- `RESOURCE` — HP/Mana gibi; max değeri BASE veya DERIVED olabilir, `current_resource` ayrıca takip edilir

**Stat hesaplama zinciri:**
```
BASE stat   = Σ(unlocked skill node bonusları × node seviyesi) + Σ(equipped item bonusları)
DERIVED stat = formula(BASE statlar)
RESOURCE    = max: DERIVED veya BASE'den gelir, current: ayrıca takip edilir
```

```sql
character_stats
  character_id      → characters.id
  stat_key          text              -- "STR"
  base_value        integer           -- Σ(skill bonusları) — cache, skill unlock değişince yeniden hesaplanır
  current_value     integer           -- base_value + Σ(equipped item stat_bonuses)
  current_resource  integer nullable  -- sadece RESOURCE tip için (mevcut HP/Mana)
  UNIQUE(character_id, stat_key)

-- DERIVED statlar bu tabloya yazılmaz.
-- base_value = Σ(character_skill_unlocks → node.stat_bonuses_per_level × current_level)
-- current_value = base_value + Σ(equipped item stat_bonuses)
-- Skill unlock/level-up olduğunda base_value yeniden hesaplanır ve cache güncellenir
-- current_resource güncelleme yetkisi: oyuncu kendi, GM herkesinki
```

### 4.5 Sınıf ve Irk

> **Tasarım kararı:** Class ve race doğrudan stat bonusu vermez. Class seçimi oyuncunun eriştiği skill tree'yi belirler. Race ise kozmetik + trait bazlıdır. Tüm stat kazanımları skill tree ilerlemesinden gelir.

```sql
classes
  id            uuid PK
  gameset_id    → gamesets.id
  name          text
  description   text
  hit_die       integer        -- 8, 10, 12
  skill_tree_root → skill_tree_nodes.id nullable  -- class skill tree kök node'u
  icon_url      text

-- NOT: stat_bonuses KALDIRILDI. Class stat bonusu vermez;
-- bunun yerine class skill tree'sindeki node'lar stat verir.

subclasses
  id              uuid PK
  class_id        → classes.id
  gameset_id      → gamesets.id
  name            text
  unlock_level    integer
  extra_skill_tree → skill_tree_nodes.id nullable  -- subclass skill tree kökü
  description     text

races
  id              uuid PK
  gameset_id      → gamesets.id
  name            text
  description     text
  racial_traits   jsonb[]        -- [{ name, description, effect }, ...]
  icon_url        text

-- NOT: stat_bonuses KALDIRILDI. Race stat bonusu vermez.
-- Racial trait'ler mekanik etki verebilir ama doğrudan stat bonusu yoktur.
```

### 4.6 Skill Tree (Stat Kaynağı)

> **Temel mekanik:** Skill tree, oyundaki **tek stat kaynağıdır**. Her gameset'te iki tür ağaç bulunur:
> 1. **Class Skill Tree** — Her class'a özel, daha derin ve ucuz node'lar
> 2. **Common Skill Tree** — Tüm class'ların erişebildiği ortak ağaç
>
> Class ağacında aynı stat bonusunu daha az skill point'e, ortak ağaçta daha fazla skill point'e koymak önerilir. Bu sayede class kimliği korunur ama hibrit build'ler de mümkün olur.

```sql
skill_tree_nodes
  id                    uuid PK
  gameset_id            → gamesets.id
  class_id              → classes.id nullable   -- NULL = Common Tree
  parent_id             → skill_tree_nodes.id nullable
  name                  text
  description           text
  node_type             ENUM(PASSIVE, ACTIVE, SPELL_UNLOCK)
  max_level             integer DEFAULT 1       -- node kaç kez yükseltilebilir
  cost_per_level        integer DEFAULT 1       -- her seviye kaç skill point harcar
  unlock_level          integer                 -- karakter seviye gereksinimi
  prerequisites         uuid[]                  -- node id'leri; DFS cycle detection zorunlu
  stat_bonuses_per_level jsonb                  -- { "STR": 2, "DEX": 1 } — her seviyede verilen bonus
  effect                jsonb nullable          -- ACTIVE/SPELL_UNLOCK için ek mekanik
  pos_x                 float
  pos_y                 float
  spell_id              → spells.id nullable    -- SPELL_UNLOCK için

-- class_id NULL → Common Tree node'u (tüm class'lar erişebilir)
-- class_id set  → Class-specific node (sadece o class erişir)

character_skill_unlocks
  id            uuid PK
  character_id  → characters.id
  node_id       → skill_tree_nodes.id
  current_level integer DEFAULT 1     -- node'daki mevcut seviye (1..max_level)
  unlocked_at   timestamptz
  UNIQUE(character_id, node_id)
```

**Skill tree mekaniği:**
1. Karakter oluşturulurken `starting_skill_points` kadar puan class + common tree'ye dağıtılır
2. Level atlandığında `skill_points_per_level` kadar yeni puan kazanılır
3. Node açma: `cost_per_level` skill point harcanır, `stat_bonuses_per_level` kadar stat kazanılır
4. Node yükseltme: aynı node'da `current_level++`, aynı bonus tekrar eklenir
5. `SPELL_UNLOCK` node açılınca büyü `character_spells`'e eklenir
6. Her skill unlock/level-up sonrası `character_stats.base_value` yeniden hesaplanır (cache güncelleme)

**Stat hesaplama örneği:**
```
Savaşçı class tree:
  "Kılıç Ustalığı" (max_level: 5, cost: 1, bonuses: { "STR": 2, "DEX": 1 })
  Seviye 3'te: STR += 6, DEX += 3

Common tree:
  "Dayanıklılık" (max_level: 3, cost: 2, bonuses: { "CON": 3 })
  Seviye 2'de: CON += 6

Toplam STR = Σ tüm unlock'ların STR bonusları = 6 + ...
```

### 4.7 Büyü Sistemi

```sql
spells
  id          uuid PK
  gameset_id  → gamesets.id
  name        text
  description text
  slot_level  integer        -- 1-9
  mana_cost   integer
  cast_time   text           -- "1 aksiyon"
  range       text
  duration    text
  effect      jsonb
  school      text           -- "Ateş", "Işık"
  icon_url    text

character_spells
  character_id  → characters.id
  spell_id      → spells.id
  is_slotted    boolean       -- aktif slotta mı
  slot_index    integer nullable
```

**Büyü kullanım akışı:**
1. Skill tree'de `SPELL_UNLOCK` node açılır
2. Büyü `character_spells`'e `is_slotted=false` olarak eklenir
3. Oyuncu büyüyü slota atar (`is_slotted=true`, `slot_index=N`)
4. Oyun odasında slot'tan büyü kullanır → `char:use_spell` event
5. Sunucu: slot dolu mu? Mana yeterli mi? → `current_resource` düşür → efekti uygula
6. Sonuç tüm odaya broadcast edilir

### 4.8 Eşya Sistemi

```sql
item_definitions
  id              uuid PK
  gameset_id      → gamesets.id
  name            text
  category        ENUM(WEAPON, ARMOR, CONSUMABLE, MISC, QUEST)
  equipment_slot  text nullable      -- "chest", "weapon_main", null
  grid_w          integer            -- EFT grid genişliği
  grid_h          integer            -- EFT grid yüksekliği
  weight          float
  stat_bonuses    jsonb              -- { "STR": 2, "DEX": -1 }
  stackable       boolean
  max_stack       integer
  description     text
  icon_url        text
```

### 4.9 Karakter Instance Tabloları

```sql
characters
  id            uuid PK
  owner_id      → users.id
  session_id    → sessions.id NOT NULL
  gameset_id    → gamesets.id NOT NULL
  name          text
  public_data   jsonb    -- { name, race, class, level, avatar_url, alignment, backstory }
  private_data  jsonb    -- { notes } -- sadece sahip + GM
  updated_at    timestamptz

character_inventory
  id              uuid PK
  character_id    → characters.id
  item_def_id     → item_definitions.id
  quantity        integer
  grid_x          integer nullable    -- sol üst köşe X (0-indexed)
  grid_y          integer nullable    -- sol üst köşe Y (0-indexed)
  is_rotated      boolean DEFAULT false
  is_equipped     boolean DEFAULT false
  equipped_slot   text nullable
  custom_props    jsonb nullable      -- { condition: 0.85, charges: 3 }
  added_by_gm_id  → users.id
  added_at        timestamptz
  is_dropped      boolean DEFAULT false   -- soft delete
  dropped_at      timestamptz nullable

character_wallet
  character_id      → characters.id
  currency_unit_id  → currency_units.id
  amount            integer
  UNIQUE(character_id, currency_unit_id)
```

### 4.10 Ekonomi Tabloları

```sql
currency_units
  id            uuid PK
  gameset_id    → gamesets.id
  name          text           -- "Altın"
  abbreviation  text           -- "AL"
  icon          text
  base_value    integer        -- en küçük birim = 1; Gümüş=10, Altın=100
  sort_order    integer

-- Para birimi kuralı: Tüm işlemler base_value cinsinden yapılır.
-- Negatif bakiye yasak: totalBase < 0 → işlem reddedilir.

stores
  id          uuid PK
  gameset_id  → gamesets.id
  name        text
  description text
  keeper_name text            -- NPC ismi
  created_by  → users.id

store_items
  id              uuid PK
  store_id        → stores.id
  item_def_id     → item_definitions.id
  rarity          ENUM(COMMON, UNIQUE)
  quota           integer     -- kaç adet alınabilir
  display_order   integer
  -- Fiyat bu tabloda YOK. GM her işlemde anlık belirler.

session_store_state
  session_id        → sessions.id
  store_id          → stores.id
  is_active         boolean
  quota_remaining   jsonb      -- { store_item_id: kalan_adet }
  activated_at      timestamptz

pending_transactions
  id              uuid PK
  session_id      → sessions.id
  store_id        → stores.id
  character_id    → characters.id
  type            ENUM(BUY, SELL)
  items           jsonb        -- [{ item_def_id, qty }]
  status          ENUM(PENDING, APPROVED, REJECTED)
  price_in_base   integer nullable    -- GM girer
  created_at      timestamptz
  -- Atomik işlem: wallet düşme + inventory ekleme + kota düşme tek Prisma transaction
  -- SELECT FOR UPDATE zorunlu (race condition önleme)
```

### 4.11 Karakter Onay ve Chat

```sql
character_approval_requests
  id            uuid PK
  session_id    → sessions.id
  player_id     → users.id
  status        ENUM(PENDING, APPROVED, REJECTED)
  snapshot      jsonb    -- wizard'ın tüm verisi: race_id, class_id, stats, details
  gm_comment    text nullable
  submitted_at  timestamptz
  reviewed_at   timestamptz nullable
  UNIQUE(session_id, player_id) WHERE status = 'PENDING'

chat_messages
  id          uuid PK
  session_id  → sessions.id
  sender_id   → users.id
  type        ENUM(IC, OOC, SYSTEM, ROLL)
  content     text
  sent_at     timestamptz

dice_rolls
  id          uuid PK
  session_id  → sessions.id
  user_id     → users.id
  formula     text        -- "2d6+3"
  result      jsonb       -- { total, rolls: [3,4], modifier: 3 }
  rolled_at   timestamptz
```

### 4.12 Cascade Silme Kuralları

```
sessions SİLİNİNCE → CASCADE:
  characters → character_stats, character_inventory,
               character_wallet, character_spells,
               character_skill_unlocks, character_approval_requests
  session_players
  session_store_state
  pending_transactions (PENDING olanlar önce REJECTED yapılır)
  chat_messages, dice_rolls

gamesets SİLİNME KURALI:
  Aktif session'a bağlı versiyon SİLİNEMEZ → 400 hatası
  Soft delete tercih edilmeli (is_deleted flag)
```

---

## 5. Kullanıcı Rolleri ve Yetki Sistemi

| İşlem | PLAYER | GM | ADMIN |
|---|---|---|---|
| Kendi karakterini düzenle | ✓ | ✓ | ✓ |
| Başkasının karakterini düzenle | ✗ | GM notu hariç ✗ | ✓ |
| Envantere eşya ekle | ✗ | ✓ | ✓ |
| HP/Mana güncelle | Kendi | Herkesin | Herkesin |
| Session oluştur | ✗ | ✓ | ✓ |
| Mağaza aç/kapat | ✗ | ✓ | ✓ |
| Transaction onayla | ✗ | ✓ | ✓ |
| Karakter onayı | ✗ | ✓ | ✓ |
| Gameset editörü | ✗ | ✓ | ✓ |
| GM rolü ver | ✗ | ✗ | ✓ |
| Admin paneli | ✗ | ✗ | ✓ |

> **Güvenlik kuralı:** Her API route + Socket event → JWT doğrulama → Role kontrolü → Resource ownership → İşlem. Client validasyonu sadece UX amaçlı; sunucu her zaman tekrar doğrular.

---

## 6. Gerçek Zamanlı Sistem — Socket.io Event Haritası

### Session Yönetimi

```
Client → Server:
  session:join          { sessionId, token }
  session:leave

Server → Client (broadcast):
  session:player_joined   { user }
  session:player_left     { userId }
  player:character_approved  { character: public_data }  → tüm odaya
                             { character: full_data }    → sadece sahibine
```

### Chat ve Zar

```
Client → Server:
  chat:send             { type: IC|OOC, content }
  dice:roll             { formula }              -- rpg-dice-roller parse eder

Server → Client:
  chat:message          { message }
  dice:result           { user, formula, result }
```

### Karakter Güncellemeler

```
Client → Server:
  character:update          { field, value }         -- public data
  character:update_private  { field, value }         -- private data
  char:update_resource      { statKey, newValue }    -- HP/Mana güncelleme
  char:use_spell            { spellId, slotIndex }

Server → Client:
  character:public_updated   { charId, patch }  → tüm odaya
  character:private_updated  { charId, patch }  → sadece sahip + GM
  char:stats_updated         { charId, stats }  → equip/unequip sonrası
```

### Inventory

```
Client → Server:
  inv:move      { inventoryId, newX, newY, isRotated }
  inv:equip     { inventoryId, slot }
  inv:drop      { inventoryId }

GM → Server:
  gm:item_add   { characterId, itemDefId, gridX, gridY, isRotated }

Server → Client:
  inv:item_added    → sahip + GM
  inv:item_moved    → sahip + GM
  inv:equipped      → sahip + GM (+ char:stats_updated)
  inv:item_dropped  → sahip + GM
  gm:item_add_fail  → sadece GM ("Envanter dolu")
```

### Mağaza

```
GM → Server:
  gm:store_open     { storeId }
  gm:store_close
  gm:tx_approve     { txId, priceInBase }
  gm:tx_reject      { txId }

Client → Server:
  store:buy_request   { items: [{ itemDefId, qty }] }
  store:sell_request  { inventoryIds: [] }

Server → Client:
  store:opened         { store, items, quotas }  → tüm odaya
  store:closed                                    → tüm odaya
  store:pending_buy    { txId, character, items } → sadece GM
  store:pending_sell   { txId, character, items } → sadece GM
  store:tx_complete                               → ilgili oyuncuya
  store:tx_rejected                               → ilgili oyuncuya
```

### Karakter Onay

```
Client → Server:
  char:submit_for_approval  { sessionId, snapshot: { raceId, classId, stats, details } }

Server → GM:
  gm:approval_request  { requestId, player, snapshot }

GM → Server:
  gm:approve_character  { requestId }
  gm:reject_character   { requestId, comment }

Server → Client:
  char:approval_rejected  { comment }  → wizard'a geri dön
```

---

## 7. Ruleset Editörü

**Route:** `/gm/gamesets/[id]/edit`

### Sekme Yapısı

| Sekme | İçerik |
|---|---|
| Genel | Gameset adı, açıklama, genel config (max_level, starting_skill_points, skill_points_per_level, equipment_slots, mana_label) |
| Stat Tanımları | Stat grupları + stat key/label/type tanımları (BASE/DERIVED/RESOURCE) |
| Sınıf / Irk | Sınıf kartları + subclass yönetimi + ırk kartları (trait bazlı, stat bonusu yok) |
| Skill Ağacı | React Flow canvas — **Class tree + Common tree** — node editörü (seviye, maliyet, stat bonusu) |
| Büyüler | Büyü listesi + filtreler + büyü formu |
| Eşyalar | Eşya listesi + kategori filtresi + eşya formu |

Her sekme bağımsız kaydeder. Değişiklikler **"Yayınla"** ile bir sonraki session'dan itibaren geçerli olur.

### Stat Tanımları Sekmesi

- Sol panel: Grup listesi (+ ekle, sürükle-bırak sırala)
- Sağ panel: Seçili grubun stat tanımları
  - Stat ekleme: key, label, tip (BASE/DERIVED/RESOURCE)
  - BASE → is_public toggle, opsiyonel max_val (değer skill tree'den gelir, burada sadece tanım)
  - DERIVED → görsel formula builder açılır
  - RESOURCE → mevcut/max + renk seçimi
- **Görsel formula builder:** `[STR ▾] [× ▾] [level ▾] [+ ▾] [10]`
- **Not:** Bu sekmede stat **değer** atanmaz, sadece stat'ın ne olduğu tanımlanır. Değerler skill tree node'larında belirlenir.

### Skill Ağacı Sekmesi

- Üstte seçici: **Common Tree** | Sınıf1 | Sınıf2 | ... (dropdown veya tab)
- `@xyflow/react` canvas; sağ tık → node ekle
- Node paneli:
  - Tip: PASSIVE / ACTIVE / SPELL_UNLOCK
  - Ad, açıklama
  - **Max seviye** (1–10)
  - **Seviye başına maliyet** (skill point)
  - **Seviye başına stat bonusu** — { "STR": 2, "DEX": 1 } (mevcut stat key'lerinden seçim)
  - Unlock level (karakter seviye gereksinimi)
  - Prerequisites (diğer node'lara bağlantı)
  - SPELL_UNLOCK ise → büyü seçimi
- **Cycle detection:** Bağlantı eklenirken DFS ile döngü kontrol; döngü varsa reddedilir
- **Common tree** node'ları: class_id = NULL olarak kaydedilir, tüm class'lar erişir
- **Balans ipucu:** GM aynı stat bonusunu class tree'de ucuza, common tree'de pahalıya koyarak class kimliğini korur

### Eşya Sekmesi

- Form: ad, kategori, ağırlık, `grid_w × grid_h` (önizleme gösterir), equipment_slot, stat_bonuses, stackable/max_stack, ikon
- `grid_w × grid_h` → GM belirler (hafif eşya 1×1, ağır zırh 4×4)

---

## 8. Karakter Oluşturma Akışı

### Tetikleyici

```
/session/[id] açılır
  ↓
DB: character WHERE session_id=X AND owner_id=user
  ↓
Karakter var? → Session'a doğrudan gir
Yok?         → /session/[id]/create-character (wizard)
```

### Wizard — 5 Adım

| Adım | İçerik |
|---|---|
| 1 — Irk Seçimi | Kart grid'i; seç → sağda detay + racial_traits |
| 2 — Sınıf Seçimi | Kart grid'i; hit_die, açıklama; seçilen class'ın skill tree önizlemesi |
| 3 — Skill Dağıtımı | Class tree + Common tree görsel canvas; `starting_skill_points` kadar puan dağıtılır; stat önizlemesi anlık güncellenir; draft localStorage'da |
| 4 — Karakter Detayları | Ad (zorunlu); avatar, alignment, backstory, notlar (opsiyonel) |
| 5 — Özet ve Gönderim | Salt-okunur özet (seçilen skill'ler + hesaplanan statlar) → "GM'e Gönder" → `character_approval_requests` INSERT |

### GM Onay Akışı

```
Oyuncu gönderir → PENDING request
  ↓
GM panelinde rozet: "Onay Bekleyenler (N)"
  ↓
GM özeti inceler → ONAYLA veya REDDET+yorum
  ↓
Onay → tek Prisma transaction:
  1. characters INSERT (snapshot'tan)
  2. character_skill_unlocks INSERT (snapshot'taki skill seçimleri)
  3. character_stats INSERT (skill bonuslarından hesaplanan base_value'lar)
  4. character_wallet INSERT (her currency_unit için amount=0)
  5. approval_request.status = APPROVED
  6. socket: session:character_approved broadcast

Red → char:approval_rejected { comment } → oyuncu wizard'a döner, seçimler korunur
```

### Sunucu Validasyonu (Submit'te)

- race_id, class_id gameset'te mevcut mu?
- Seçilen skill node'ları geçerli mi? (class tree + common tree'de var mı?)
- Her node'un unlock_level gereksinimi karşılanıyor mu?
- Her node'un prerequisite'leri açılmış mı?
- Harcanan toplam skill point ≤ starting_skill_points?
- Node seviyeleri max_level'ı aşmıyor mu?
- Ad dolu mu?
- Zaten onaylı karakter var mı?
- Zaten PENDING request var mı?

---

## 9. Grid Inventory Sistemi

### Grid Konfigürasyonu

`gamesets.config` içinde:
```json
{
  "inventory_cols": 12,
  "inventory_rows": 10,
  "equipment_slots": ["head","chest","hands","legs","feet","weapon_main","weapon_off","ring1","ring2","neck"]
}
```

### Döndürme

```
is_rotated = false → eff_w = grid_w, eff_h = grid_h
is_rotated = true  → eff_w = grid_h, eff_h = grid_w
```

### Çakışma Algoritması (Server-Side)

```
1. Sınır kontrolü: x + eff_w ≤ cols, y + eff_h ≤ rows
2. Kaplayacağı hücreler hesaplanır
3. Mevcut envanter hücre kümesiyle kesişim kontrol edilir
4. Kesişim varsa → 409 Conflict
5. Yoksa → DB'ye yaz
```

> **Kritik:** Client-side önizleme sadece UX. Gerçek validasyon sunucuda.

### Equip Validasyonu

- `item.equipment_slot == hedef slot` — uyumsuzsa reddedilir
- Slot doluysa önce unequip → grid'e döner (yer yoksa hata)
- Equip → `character_stats.current_value` stat bonusu eklenir
- Unequip → bonus geri alınır (`base_value` değişmez)

### Oyuncu Aksiyonları

| İşlem | İzin |
|---|---|
| Grid içinde taşı | ✓ |
| Döndür (R) | ✓ |
| Equip / unequip | ✓ |
| Kullan (CONSUMABLE) | ✓ |
| At (Drop) → soft delete | ✓ |
| Mağazaya sat | ✓ (mağaza aktifse) |
| Envantere eşya ekle | ✗ (sadece GM) |
| Başkasına transfer | ✗ (GM aracılığı) |

---

## 10. Ekonomi ve Mağaza Sistemi

### Para Birimi

Hiyerarşik sistem: örn. Bakır=1, Gümüş=10, Altın=100 (GM tanımlar).

```
Ödeme algoritması:
  1. En büyük birimden başla
  2. Yetmiyorsa küçüğe geç
  3. Üstü varsa küçük birime ekle
  4. totalBase < price → işlem reddedilir
  5. Negatif bakiye yasak
```

### Mağaza Kuralları

- Mağaza gameset'e aittir, session'dan bağımsız tanımlanır
- GM istediği session'da aktifleştirir
- **Fiyat hiçbir eşyada önceden tanımlı değildir** — GM her işlemde anlık belirler (TTRPG ruhu)
- Satılan eşya mağaza kotasını **etkilemez**, mağazaya geri dönmez

### Alışveriş Akışı

**Alım:**
1. GM mağazayı açar → oyuncular eşya listesini görür
2. Oyuncu talep oluşturur → `pending_transaction`
3. GM RP sonucu fiyatı girer → APPROVED
4. Sunucu atomik transaction: para yeterli mi? kota var mı? envanter boş mu?

**Satım:**
1. Oyuncu envanterden eşya seçer → "Sat" → `pending_transaction (SELL)`
2. GM alış fiyatı girer → APPROVED → eşya çıkar, para eklenir

### Transaction Atomikliği

`gm:tx_approve` geldiğinde: wallet düşme + inventory ekleme/çıkarma + kota düşme **tek Prisma `$transaction`** içinde. `SELECT FOR UPDATE` zorunlu. Biri başarısız → tümü rollback.

---

## 11. Oyun Odası Layout

### Masaüstü (3 Kolon)

```
┌─────────────────────────────────────────────────────────┐
│ Topbar: Session adı · Aktif · Davet kodu · Ayarlar      │
├──────────────┬────────────────────────┬─────────────────┤
│ SOL (220px)  │ ORTA                   │ SAĞ (260px)     │
│              │                        │                 │
│ Oyuncular    │ GM Band (GM only):     │ Chat (IC/OOC)   │
│ ─ Kendi kartı│ Mağaza Aç · Eşya Ver  │                 │
│   HP/Mana    │ Para · Onay Bekleyenler│ Mesaj balonları │
│   [Karakter] │                        │                 │
│   [Envanter] │ Olay Kaydı:            │ Input satırı    │
│ ─ Diğerleri  │ ZAR · SİSTEM ·        │                 │
│   (public)   │ MAĞAZA events         │                 │
│ ─ GM kartı   │                        │                 │
│              │                        │                 │
│ Zar Atacı    │                        │                 │
│ d4..d100     │                        │                 │
│ Formula input│                        │                 │
└──────────────┴────────────────────────┴─────────────────┘
```

### Mobil (Sekme Bazlı)

4 sekme: **Chat · Oyuncular · Zarlar · Log**

Alt çubukta kendi karakter özeti (HP/Mana) her zaman sabit görünür.

### Chat Renk Kodlaması

| Mesaj tipi | Renk |
|---|---|
| GM mesajı | Amber/mor |
| Kendi mesajı | Mavi |
| Diğer oyuncu | Yeşil |
| Zar sonucu | Kırmızı çerçeve |
| Sistem eventi | Mavi arka plan |

---

## 12. Görünürlük Kuralları

| Veri | Diğer oyuncular | Karakter sahibi | GM |
|---|---|---|---|
| Ad, ırk, sınıf, seviye | ✓ | ✓ | ✓ |
| Alignment | ✓ | ✓ | ✓ |
| Avatar | ✓ | ✓ | ✓ |
| Geçmiş hikayesi | ✓ | ✓ | ✓ |
| HP / Mana (public stat ise) | ✓ | ✓ | ✓ |
| Stat detayları (private) | ✗ | ✓ | ✓ |
| Skill tree ilerlemesi | ✗ | ✓ | ✓ |
| Private notlar | ✗ | ✓ | ✓ |
| Inventory detayı | ✗ | ✓ | ✓ |
| GM notları | ✗ | ✗ | ✓ |

`stat_definitions.is_public` — her stat için GM ayrı ayrı belirler.

---

## 13. Gameset Versiyon Sistemi

**Mimari Karar:** Snapshot veya version lock yok. Versiyonlar bağımsız `gamesets` satırları olarak yaşar. `parent_gameset_id` ile soy ağacı tutulur. Session doğrudan bir gameset versiyonuna bağlanır.

### GM İş Akışı

1. Ruleset listesinde tüm versiyonlar ve bağlı session'lar görünür
2. GM yeni versiyon oluşturur (mevcut versiyon kopyalanır, `version++`)
3. Session'ı yeni versiyona geçirmek GM tercihidir — otomatik olmaz
4. Session içindeyken de ruleset değişikliği mümkündür (GM bilinçli yapar)

### Silme Kuralları

- Aktif session'a bağlı versiyon silinemez → "Bu versiyona bağlı X session var" uyarısı
- Soft delete tercih edilmeli (`is_deleted` flag)

---

## 14. Karakter Yaşam Döngüsü ve Export

### Yaşam Döngüsü

```
Oluşturulma (wizard + GM onayı)
  ↓
Aktif yaşam (session süresince)
  ↓
Session kapanır → status: CLOSING
  ↓
7 günlük grace period (export penceresi)
  ├─ Oyunculara e-posta: "7 gün içinde export alın"
  ├─ Gün 5: "2 gün kaldı" hatırlatması
  └─ Gün 7: Vercel Cron → session DELETE → CASCADE silme
```

### Export Endpoint

```
GET /api/characters/[id]/export
  Auth: JWT (sahip veya GM)
  Session status: ACTIVE veya CLOSING
  CLOSED + grace period bitti → 410 Gone
  Rate limit: 10 export/saat
```

**Export JSON formatı:**
```json
{
  "export_version": "1.0",
  "exported_at": "ISO timestamp",
  "character": { "...public_data", "...private_data" },
  "stats": [{ "key": "STR", "base_value": 14 }],
  "inventory": [{ "item_name": "Uzun Kılıç", "grid_w": 2, "grid_h": 4, "equipped_slot": "weapon_main" }],
  "wallet": [{ "currency": "Altın", "amount": 5 }],
  "spells": [{ "name": "Ateş Topu", "slot_level": 3, "is_slotted": true }],
  "gameset_name": "Karanlık Evren v2",
  "session_name": "Karanlık Orman Seferi"
}
```

### Vercel Cron Job

```
Route: GET /api/cron/cleanup-sessions
Auth: Authorization: Bearer CRON_SECRET
Schedule: günlük

DELETE FROM sessions
WHERE status = 'CLOSING'
AND closed_at < NOW() - INTERVAL '7 days'
```

---

## 15. Edge Case'ler ve Hata Senaryoları

### Ağ ve Gerçek Zamanlı

| Senaryo | Davranış |
|---|---|
| Oyuncu bağlantısı kopuyor | "Çevrimdışı" göster; 5dk sonra PENDING tx REJECTED; auto-reconnect backoff |
| GM bağlantısı kopuyor | Mağaza açık kalır; 10dk dönmezse "GM Yok" modu |
| Eş zamanlı kota çakışması | İlk onaylanır; ikincide kota=0 → auto REJECTED |
| Envanter çakışması | SELECT FOR UPDATE + 409 Conflict |
| Socket.io restart | ~2-5sn kesinti tolere; client reconnect → DB'den state |

### Güvenlik

| Senaryo | HTTP/Davranış |
|---|---|
| Oyuncu başkasının karakterini düzenler | 403 Forbidden |
| Oyuncu GM socket event'i gönderir | Ignore + logla |
| Manipüle grid koordinatı | 400 Bad Request |
| Davet kodu olmadan session'a giriş | 403 Forbidden |
| JWT süresi dolmuş | NextAuth refresh → başarısızsa /login |

### Ekonomi Güvenliği

| Durum | Davranış |
|---|---|
| Para yetmez, GM onaylasa bile | Server totalBase kontrolü → REJECTED (GM bypass edemez) |
| Transaction çift onaylanır | `WHERE status='PENDING'` koşulu → idempotent |
| Negatif bakiye girişimi | `totalBase < 0` → reddedilir |
| Envanter dolu, alım onaylanır | Para alınmaz; eşya overflow; GM bildirim alır |

---

## 16. Sayfa Yapısı ve Rotalar

### Herkese Açık
```
/                     Ana sayfa
/login                Giriş
/register             Kayıt
/join/[invite_code]   Davet kodu ile session katılımı
```

### Player (Giriş yapmış)
```
/dashboard                     Oyuncu dashboard'u (session listesi)
/session/[id]                  Oyun odası
/session/[id]/create-character Karakter wizard'ı
/character/[id]                Karakter sayfası (sheet, skills, spells, inventory)
```

### GM Paneli
```
/gm/sessions                  Session listesi
/gm/session/[id]              Session'ın GM görünümü (+ GM controls)
/gm/gamesets                  Gameset listesi (tüm versiyonlar)
/gm/gamesets/[id]/edit        Ruleset editörü (6 sekme)
/gm/stores                    Mağaza yönetimi
/admin/users                  Kullanıcı yönetimi (ADMIN only)
```

---

## Kritik Implementasyon Notları

1. **Tüm stat değerleri skill tree'den türetilir.** Oyuncu doğrudan stat puanı dağıtmaz. `character_stats.base_value` bir cache'dir ve her skill unlock/level-up'ta yeniden hesaplanır.
2. **İki tür skill tree:** Class tree (class_id set) + Common tree (class_id NULL). Oyuncu her ikisine de puan harcayabilir.
3. **DERIVED statlar hiçbir zaman DB'ye yazılmaz.** Her okumada formula'dan hesaplanır.
4. **Grid collision sunucuda yapılır.** Client önizleme sadece UX.
5. **Tüm ekonomi işlemleri `SELECT FOR UPDATE` + Prisma `$transaction`.**
6. **`character_approval_requests.snapshot` jsonb** — wizard verisi (skill seçimleri dahil) onaylanana kadar burada yaşar, gerçek tablolara yazılmaz.
7. **Mağaza fiyatı asla önceden tanımlı değildir.** `price_in_base` sadece GM onayladığında set edilir.
8. **`@xyflow/react`** — React Flow'un MIT lisanslı yeni paket adı; ticari kullanımda sorun yok.
9. **Gameset versiyonları bağımsız DB satırlarıdır.** Snapshot/version lock mekanizması yok.
