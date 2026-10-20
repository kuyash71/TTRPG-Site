// Karakter dilleri. Karakter oluştururken listeden seçilir; ilk seçilen ana dildir.
// Başlangıç kuralı: 2 dil (ana dil + 1). Monolingual 1, Trilingual (SHZ) / Polyglot (UC) 3.
// GM sonradan karakter ayrıntılarından dil ekleyip değiştirebilir (listede olmayan dil de yazabilir).
import type { GameSystem } from "../db/schema";

/** Schwarzesonne: günümüzün en çok konuşulan 50 dili (toplam konuşur sayısına göre, yaklaşık sıra). */
export const SHZ_LANGUAGES = [
  "İngilizce",
  "Mandarin Çincesi",
  "Hintçe",
  "İspanyolca",
  "Arapça",
  "Fransızca",
  "Bengalce",
  "Portekizce",
  "Rusça",
  "Endonezce",
  "Urduca",
  "Almanca",
  "Japonca",
  "Marathi",
  "Vietnamca",
  "Telugu",
  "Hausa",
  "Türkçe",
  "Pencapça",
  "Svahili",
  "Filipince (Tagalog)",
  "Tamilce",
  "Kantonca",
  "Farsça",
  "Korece",
  "Tayca",
  "Cava dili",
  "İtalyanca",
  "Gujarati",
  "Amharca",
  "Kannada",
  "Lehçe",
  "Yoruba",
  "Ukraynaca",
  "Malayca",
  "Felemenkçe",
  "Rumence",
  "Peştuca",
  "Özbekçe",
  "Azerbaycan Türkçesi",
  "Kürtçe",
  "Yunanca",
  "Macarca",
  "Çekçe",
  "İsveççe",
  "Sırp-Hırvatça",
  "Zuluca",
  "Birmanca",
  "Nepalce",
  "İbranice",
] as const;

/**
 * Umbra Caelis dilleri: yazım aşamasında (WIP). Liste dolunca karakter oluşturmada seçim zorunlu olur;
 * boşken oyuncu dil seçmeden devam eder ve GM dilleri karakter ayrıntılarından ekler.
 */
export const UC_LANGUAGES: readonly string[] = [];

export function languageList(system: GameSystem): readonly string[] {
  return system === "UC" ? UC_LANGUAGES : SHZ_LANGUAGES;
}

/** Başlangıçta seçilecek dil sayısı (perklere göre). */
export function languageSlots(system: GameSystem, perks: readonly string[]) {
  if (perks.includes("monolingual")) return 1;
  if (system === "SHZ" ? perks.includes("trilingual") : perks.includes("polyglot")) return 3;
  return 2;
}

/** Oluşturmadaki dil seçiminin sorunları (boş dizi = geçerli). */
export function languageProblems(system: GameSystem, perks: readonly string[], picked: readonly string[]) {
  const list = languageList(system);
  if (!list.length) return picked.length ? ["Bu sistemde diller henüz tanımlı değil; dilleri GM ekler."] : [];
  const out: string[] = [];
  const need = languageSlots(system, perks);
  if (new Set(picked).size !== picked.length) out.push("Aynı dil iki kez seçilmiş");
  if (picked.some((l) => !list.includes(l))) out.push("Listede olmayan dil");
  if (picked.length !== need) out.push(`Tam olarak ${need} dil seçilmeli (ilki ana dil)`);
  return out;
}

/** GM düzenlemesi: listeden ya da elle yazılmış diller. */
export function cleanLanguages(langs: readonly string[]) {
  const out: string[] = [];
  for (const l of langs) {
    const v = l.trim().replace(/\s+/g, " ").slice(0, 40);
    if (v && !out.some((x) => x.toLocaleLowerCase("tr-TR") === v.toLocaleLowerCase("tr-TR"))) out.push(v);
  }
  return out.slice(0, 12);
}
