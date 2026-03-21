# TTRPG Oyun Yönetim Sitesi — Design System

> Son güncelleme: 2026-03

---

## Tema

**Konsept:** Dark Gothic / Grotesk — karanlık fantezi dünyasını yansıtan, ağır ve atmosferik bir arayüz.

**Mod:** Sadece koyu tema (dark-only). Açık tema yok.

---

## Renk Paleti

### Temel Yüzeyler (Background)

| Token | Hex | Kullanım |
|---|---|---|
| `void` | `#09090b` | Sayfa arka planı (en koyu) |
| `surface` | `#111114` | Kart / panel arka planı |
| `surface-raised` | `#1a1a1f` | Hover, yükseltilmiş panel, modal |
| `surface-overlay` | `#222228` | Dropdown, popover, tooltip |

### Lavender (Accent — Primary)

| Token | Hex | Kullanım |
|---|---|---|
| `lavender-50` | `#f5f3ff` | Çok açık — badge arka plan |
| `lavender-100` | `#ede9fe` | Açık — hover text |
| `lavender-200` | `#ddd6fe` | — |
| `lavender-300` | `#c4b5fd` | Aktif link, secondary text |
| `lavender-400` | `#a78bfa` | **Primary accent** — buton, link, vurgu |
| `lavender-500` | `#8b5cf6` | Hover buton |
| `lavender-600` | `#7c3aed` | Aktif/pressed buton |
| `lavender-700` | `#6d28d9` | — |
| `lavender-800` | `#5b21b6` | Border vurgu |
| `lavender-900` | `#4c1d95` | Koyu arka plan vurgu |

### Gold (Accent — Secondary / GM)

| Token | Hex | Kullanım |
|---|---|---|
| `gold-50` | `#fffbeb` | — |
| `gold-100` | `#fef3c7` | — |
| `gold-200` | `#fde68a` | Açık vurgu text |
| `gold-300` | `#fcd34d` | Badge, ikon |
| `gold-400` | `#fbbf24` | **GM accent** — GM paneli, önemli aksiyon |
| `gold-500` | `#f59e0b` | Hover |
| `gold-600` | `#d97706` | Aktif/pressed |
| `gold-700` | `#b45309` | — |
| `gold-800` | `#92400e` | Border vurgu |
| `gold-900` | `#78350f` | Koyu arka plan vurgu |

### Nötr (Text & Border)

| Token | Hex | Kullanım |
|---|---|---|
| `text-primary` | `#e4e4e7` | Ana metin (zinc-200) |
| `text-secondary` | `#a1a1aa` | İkincil metin (zinc-400) |
| `text-muted` | `#71717a` | Soluk metin (zinc-500) |
| `border-default` | `#27272a` | Kart border (zinc-800) |
| `border-subtle` | `#1e1e22` | İnce ayırıcı |
| `border-strong` | `#3f3f46` | Vurgulu border (zinc-700) |

### Semantik Renkler

| Token | Hex | Kullanım |
|---|---|---|
| `success` | `#4ade80` | Başarı (green-400) |
| `error` | `#f87171` | Hata (red-400) |
| `warning` | `#fbbf24` | Uyarı (= gold-400) |
| `info` | `#a78bfa` | Bilgi (= lavender-400) |

---

## Tipografi

### Font Ailesi

| Kullanım | Font | Stil |
|---|---|---|
| **Başlıklar (H1-H4)** | **Cinzel** | Serif, gotik hissiyat — menü başlıkları, sayfa title'ları |
| **Gövde metni** | **Inter** | Sans-serif, okunabilir — paragraflar, form, tablo |
| **Mono / kod** | **JetBrains Mono** | Monospace — zar sonuçları, stat değerleri, ID'ler |

### Boyutlandırma

| Seviye | Boyut | Ağırlık | Font | Kullanım |
|---|---|---|---|---|
| `h1` | `2rem` (32px) | 700 | Cinzel | Sayfa başlığı |
| `h2` | `1.5rem` (24px) | 700 | Cinzel | Bölüm başlığı |
| `h3` | `1.25rem` (20px) | 600 | Cinzel | Kart başlığı |
| `h4` | `1.125rem` (18px) | 600 | Cinzel | Alt başlık |
| `body` | `0.9375rem` (15px) | 400 | Inter | Ana metin |
| `body-sm` | `0.8125rem` (13px) | 400 | Inter | Yardımcı metin |
| `caption` | `0.75rem` (12px) | 500 | Inter | Label, badge |
| `mono` | `0.875rem` (14px) | 400 | JetBrains Mono | Stat değeri, zar |

### Başlık Stili

Cinzel başlıklarda **letter-spacing: 0.05em** ve **uppercase** kullanılacak — gotik atmosferi güçlendirir.

```css
.heading-gothic {
  font-family: 'Cinzel', serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## Komponent Stilleri

### Butonlar

| Varyant | Arka Plan | Text | Border | Kullanım |
|---|---|---|---|---|
| **Primary** | `lavender-400` → `lavender-500` hover | `void` | — | Ana aksiyon |
| **Secondary** | `transparent` | `lavender-300` | `lavender-800` | İkincil aksiyon |
| **Ghost** | `transparent` → `surface-raised` hover | `text-secondary` | — | Minimal aksiyon |
| **Danger** | `transparent` | `error` | `red-900` | Silme, tehlikeli |
| **GM** | `gold-400` → `gold-500` hover | `void` | — | GM aksiyonları |

```
Border radius: 6px (rounded-md)
Padding: 8px 16px (py-2 px-4)
Font: Inter, 14px, font-medium
Transition: 150ms ease
```

### Kartlar / Paneller

```
Background: surface (#111114)
Border: 1px solid border-default (#27272a)
Border radius: 8px (rounded-lg)
Padding: 24px (p-6)
```

**GM Paneli** — gold vurgulu:
```
Border: 1px solid gold-900/50
Background: surface
```

### Input / Form

```
Background: void (#09090b)
Border: 1px solid border-default (#27272a)
Focus border: lavender-400
Text: text-primary
Placeholder: text-muted
Border radius: 6px
Padding: 8px 12px
```

### Navigasyon / Menü

Gotik menü stili:
- Font: **Cinzel**, uppercase, letter-spacing: 0.08em
- Aktif item: `lavender-400` text + alt çizgi (2px solid lavender-400)
- Hover: `lavender-300` text
- Default: `text-secondary`
- Separator: `border-subtle` dikey çizgi

### Badge / Chip

| Varyant | Background | Text |
|---|---|---|
| `role-user` | `zinc-800` | `zinc-300` |
| `role-gm` | `gold-900/30` | `gold-400` |
| `role-admin` | `lavender-900/30` | `lavender-400` |
| `status-open` | `green-900/30` | `green-400` |
| `status-active` | `lavender-900/30` | `lavender-400` |
| `status-closed` | `zinc-800` | `zinc-500` |

---

## Dekoratif Detaylar

### Gotik Süslemeler

- **Divider ornament:** Bölüm ayırıcılarında ortada küçük bir `◆` (diamond) veya `✦` sembolü
- **Kart köşeleri:** Opsiyonel olarak köşelerde ince gotik çerçeve detayları (CSS border-image veya pseudo-element)
- **Glow efekti:** Önemli butonlarda hafif `box-shadow: 0 0 20px rgba(167, 139, 250, 0.15)` (lavender glow)
- **Gold glow (GM):** `box-shadow: 0 0 20px rgba(251, 191, 36, 0.1)`

### Geçiş ve Animasyon

```
transition-all: 150ms ease
hover scale: yok (flat tasarım)
focus ring: 2px solid lavender-400, offset 2px
```

---

## Spacing Sistemi

Tailwind default spacing scale:
- `gap-1` (4px) — ikon + text arası
- `gap-2` (8px) — inline elementler
- `gap-3` (12px) — form alanları arası
- `gap-4` (16px) — kart içi bölümler
- `gap-6` (24px) — bölümler arası
- `gap-8` (32px) — major bölümler

---

## Responsive Breakpoint'ler

| Breakpoint | Min Width | Layout |
|---|---|---|
| `mobile` | 0 | Tek kolon, tab navigasyon (alt bar) |
| `sm` | 640px | — |
| `md` | 768px | 2 kolon grid başlar |
| `lg` | 1024px | 3 kolon oyun odası layout |
| `xl` | 1280px | Max container width |

---

## Renk Kullanım Kuralları

1. **Lavender** = oyuncu aksiyonları, genel vurgu, link, primary buton
2. **Gold** = GM aksiyonları, GM paneli, önemli bildirim, ödül
3. **Her iki renk birlikte kullanılmaz** — aynı komponentte lavender + gold karışmaz
4. **Nötr yüzeyler baskın** — renk sadece vurgu noktalarında, arayüz ağırlıklı olarak koyu gri tonlarında kalır
5. **Beyaz (#fff) doğrudan kullanılmaz** — en açık text `text-primary` (#e4e4e7)
