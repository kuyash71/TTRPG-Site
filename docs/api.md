# API Referansı

Tüm endpoint'ler Next.js App Router `/app/api/` altında tanımlanır. Socket.io event'leri için → [architecture.md#6](architecture.md#6-gerçek-zamanlı-sistem--socketio-event-haritası)

---

## İçindekiler

1. [Auth](#auth)
2. [Sessions](#sessions)
3. [Gamesets](#gamesets)
4. [Characters](#characters)
5. [Inventory](#inventory)
6. [Stores](#stores)
7. [Cron](#cron)

---

## Genel Kurallar

### Authentication

Tüm korumalı endpoint'ler `Authorization: Bearer <jwt>` veya NextAuth session cookie bekler.

### Yetki Zinciri

```
JWT doğrulama → Role kontrolü → Resource ownership → İşlem
```

Client validasyonu sadece UX amaçlıdır. Sunucu her zaman tekrar doğrular.

### HTTP Durum Kodları

| Kod | Anlam |
|---|---|
| 200 | Başarılı |
| 201 | Oluşturuldu |
| 400 | Geçersiz istek / iş kuralı ihlali |
| 401 | Kimlik doğrulanmadı |
| 403 | Yetki yok |
| 404 | Bulunamadı |
| 409 | Çakışma (envanter, transaction, vb.) |
| 410 | Gone (grace period bitmiş export) |
| 429 | Rate limit aşıldı |

---

## Auth

### `POST /api/auth/register`

Yeni kullanıcı kaydı.

**Body:**
```json
{
  "email": "string",
  "username": "string",
  "password": "string"
}
```

**Response 201:**
```json
{ "id": "uuid", "email": "string", "username": "string", "role": "USER" }
```

---

### `POST /api/auth/[...nextauth]`

NextAuth handler. Credential provider ile email/password girişi.

**Login body:**
```json
{ "email": "string", "password": "string" }
```

JWT payload: `{ id, email, username, role }`

---

## Sessions

### `GET /api/sessions`

Kullanıcının session'larını listeler.
- GM: kendi oluşturduğu session'lar
- Player: katıldığı session'lar

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "status": "OPEN | ACTIVE | CLOSING | CLOSED",
    "invite_code": "string",
    "gameset": { "id": "uuid", "name": "string", "version": 1 },
    "player_count": 3
  }
]
```

---

### `POST /api/sessions`

Yeni session oluşturur. **Yetki: GM, ADMIN**

**Body:**
```json
{
  "name": "string",
  "gameset_id": "uuid"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "invite_code": "string",
  "status": "OPEN"
}
```

---

### `GET /api/sessions/[id]`

Session detayı. Oyuncu session'a kayıtlı olmalı.

**Response:**
```json
{
  "id": "uuid",
  "name": "string",
  "status": "string",
  "invite_code": "string",
  "gm": { "id": "uuid", "username": "string" },
  "gameset": { "id": "uuid", "name": "string", "version": 1 },
  "players": [
    { "id": "uuid", "username": "string", "character": null }
  ]
}
```

---

### `PATCH /api/sessions/[id]`

Session durumunu günceller. **Yetki: GM (session sahibi)**

**Body:**
```json
{ "status": "ACTIVE | CLOSING | CLOSED" }
```

`CLOSING` → `closed_at` set edilir, grace period başlar.

---

### `POST /api/sessions/join`

Davet koduyla session'a katılır.

**Body:**
```json
{ "invite_code": "string" }
```

**Response 200:** Session bilgisi

**Hata 403:** Geçersiz/süresi dolmuş kod

---

## Gamesets

### `GET /api/gamesets`

GM'in gameset'lerini listeler (tüm versiyonlar dahil). **Yetki: GM, ADMIN**

---

### `POST /api/gamesets`

Yeni gameset oluşturur. **Yetki: GM, ADMIN**

**Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

---

### `GET /api/gamesets/[id]`

Gameset detayı: config, stat_groups, classes, races, spells, items.

---

### `PUT /api/gamesets/[id]`

Gameset günceller. **Yetki: GM (gameset sahibi)**

Aktif session'a bağlıysa değişiklikler bir sonraki versiyona taşınmalıdır.

---

### `POST /api/gamesets/[id]/version`

Mevcut gameset'ten yeni versiyon oluşturur (deep copy). **Yetki: GM**

**Response 201:**
```json
{ "id": "uuid", "version": 2, "parent_gameset_id": "uuid" }
```

---

### `DELETE /api/gamesets/[id]`

Gameset siler (soft delete). **Yetki: GM, ADMIN**

**Hata 400:** Aktif session'a bağlıysa silinemez.

---

### `GET /api/gamesets/[id]/stats`

Stat grupları ve tanımları.

### `POST /api/gamesets/[id]/stats`

Yeni stat tanımı ekler. **Yetki: GM**

**Body:**
```json
{
  "group_id": "uuid",
  "key": "STR",
  "label": "Güç",
  "type": "PRIMARY | DERIVED | RESOURCE",
  "min_val": 8,
  "max_val": 20,
  "formula": null,
  "is_public": true,
  "sort_order": 0
}
```

---

### `GET /api/gamesets/[id]/skill-tree`

Skill tree node'larını döndürür (class_id filtresi opsiyonel).

### `POST /api/gamesets/[id]/skill-tree/nodes`

Node ekler. **Yetki: GM**

**Validasyon:** prerequisites DFS cycle detection — döngü varsa 400.

---

## Characters

### `GET /api/characters/[id]`

Karakter detayı. Görünürlük kurallarına göre filtrelenir:
- Sahip + GM → tam veri
- Diğer oyuncular → yalnızca `public_data` + `is_public` statlar

---

### `PATCH /api/characters/[id]`

Public data günceller. **Yetki: Karakter sahibi**

**Body:** `public_data` jsonb patch

---

### `PATCH /api/characters/[id]/private`

Private data günceller. **Yetki: Karakter sahibi**

---

### `PATCH /api/characters/[id]/stats`

HP/Mana (RESOURCE stat) günceller.

**Body:**
```json
{ "stat_key": "HP", "new_value": 28 }
```

**Yetki:**
- `new_value` → kendi statı ise: sahip veya GM
- Başkasının statı → sadece GM

---

### `POST /api/characters/approval`

Karakter onay isteği gönderir. **Yetki: Player (session üyesi)**

**Body:**
```json
{
  "session_id": "uuid",
  "snapshot": {
    "race_id": "uuid",
    "class_id": "uuid",
    "stats": { "STR": 14, "DEX": 12 },
    "details": { "name": "Alaric", "backstory": "..." }
  }
}
```

**Validasyonlar:**
- race_id, class_id gameset'te mevcut mu?
- Her stat min/max aralığında mı?
- Harcanan puan ≤ starting_points?
- Zaten PENDING veya onaylı karakter var mı?

---

### `PATCH /api/characters/approval/[requestId]`

Onay isteğini onaylar veya reddeder. **Yetki: GM**

**Body:**
```json
{
  "action": "APPROVE | REJECT",
  "comment": "string (REJECT için)"
}
```

**APPROVE → Prisma transaction:**
1. `characters` INSERT
2. `character_stats` INSERT
3. `character_wallet` INSERT (her currency_unit, amount=0)
4. `approval_requests.status = APPROVED`
5. Socket broadcast: `session:character_approved`

---

### `GET /api/characters/[id]/export`

Karakter JSON export. **Yetki: Sahip veya GM**

**Koşullar:**
- Session `ACTIVE` veya `CLOSING` olmalı
- Grace period bittiyse → **410 Gone**
- Rate limit: 10 istek/saat

**Response:**
```json
{
  "export_version": "1.0",
  "exported_at": "2026-03-20T10:00:00Z",
  "character": {},
  "stats": [],
  "inventory": [],
  "wallet": [],
  "spells": [],
  "gameset_name": "string",
  "session_name": "string"
}
```

---

## Inventory

### `GET /api/characters/[id]/inventory`

Tüm inventory eşyaları. **Yetki: Sahip + GM**

---

### `POST /api/characters/[id]/inventory`

Eşya ekler. **Yetki: GM**

**Body:**
```json
{
  "item_def_id": "uuid",
  "grid_x": 0,
  "grid_y": 0,
  "is_rotated": false,
  "quantity": 1
}
```

**Sunucu validasyonu:**
- Sınır kontrolü: `x + eff_w ≤ inventory_cols`
- Çakışma kontrolü: hücre kümesi kesişimi
- Çakışma varsa → **409 Conflict**

---

### `PATCH /api/inventory/[inventoryId]`

Eşya taşır veya döndürür. **Yetki: Eşya sahibi**

**Body:**
```json
{ "grid_x": 2, "grid_y": 3, "is_rotated": true }
```

---

### `PATCH /api/inventory/[inventoryId]/equip`

Eşyayı slota takar/çıkarır. **Yetki: Eşya sahibi**

**Body:**
```json
{ "slot": "weapon_main" }
```

Equip → `character_stats.current_value` güncellenir (stat_bonuses eklenir).
Unequip → bonus geri alınır.

---

### `DELETE /api/inventory/[inventoryId]`

Eşyayı düşürür (soft delete: `is_dropped=true`). **Yetki: Eşya sahibi**

---

## Stores

### `GET /api/gamesets/[id]/stores`

Gameset'e ait mağazaları listeler. **Yetki: GM**

---

### `POST /api/gamesets/[id]/stores`

Yeni mağaza oluşturur. **Yetki: GM**

**Body:**
```json
{
  "name": "Demir Ali'nin Dükkanı",
  "description": "string",
  "keeper_name": "Demir Ali",
  "items": [
    { "item_def_id": "uuid", "rarity": "COMMON | UNIQUE", "quota": 3 }
  ]
}
```

---

### `POST /api/sessions/[id]/store/open`

Session'da mağaza açar. **Yetki: GM**

**Body:** `{ "store_id": "uuid" }`

---

### `POST /api/sessions/[id]/store/close`

Mağazayı kapatır. **Yetki: GM**

Tüm PENDING transaction'lar → REJECTED.

---

### `POST /api/transactions`

Alım/satım talebi oluşturur. **Yetki: Player (session üyesi)**

**Body:**
```json
{
  "session_id": "uuid",
  "type": "BUY | SELL",
  "items": [{ "item_def_id": "uuid", "qty": 1 }]
}
```

GM'e socket notification: `store:pending_buy` / `store:pending_sell`

---

### `PATCH /api/transactions/[txId]`

Transaction onayla/reddet. **Yetki: GM**

**Body:**
```json
{
  "action": "APPROVE | REJECT",
  "price_in_base": 150
}
```

**APPROVE → Prisma transaction (SELECT FOR UPDATE):**
- Para yeterli mi? (`totalBase ≥ price_in_base`)
- Kota var mı?
- Envanter boş mu? (BUY için)
- Atomik: wallet + inventory + kota

**Hata 409:** Eş zamanlı kota tükenmesi

---

## Cron

### `GET /api/cron/cleanup-sessions`

Grace period biten session'ları siler. **Auth: `Authorization: Bearer CRON_SECRET`**

Vercel Cron Job tarafından günlük çağrılır.

```sql
DELETE FROM sessions
WHERE status = 'CLOSING'
AND closed_at < NOW() - INTERVAL '7 days'
```

CASCADE → tüm karakterler, inventory, wallet, spells, chat silinir.

---

## Socket.io Events

REST API'nin yanı sıra gerçek zamanlı işlemler Socket.io üzerinden yürütülür. Tam event haritası için → [architecture.md#6](architecture.md#6-gerçek-zamanlı-sistem--socketio-event-haritası)

**Bağlantı:**
```js
import { io } from "socket.io-client"

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
  auth: { token: session.jwt }
})

socket.emit("session:join", { sessionId, token })
```
