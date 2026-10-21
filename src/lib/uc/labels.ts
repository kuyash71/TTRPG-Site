// Umbra Caelis kural sayfalarında (sunucu) ve kartlarda (istemci) ortak kullanılan etiketler.
// Değerler Türkçedir; gösterildikleri yerde t(...) ile çevrilir.

export const TIER_LABEL: Record<number, string> = { 1: "Katman 1", 2: "Katman 2", 3: "Katman 3" };
/** "Aktif, Vertex" → "Aktif" (Vertex ayrı rozetle gösterilir). */
export const ucBaseType = (t: string) => t.replace(/\s*,?\s*vertex\s*,?/i, "").trim() || t;
