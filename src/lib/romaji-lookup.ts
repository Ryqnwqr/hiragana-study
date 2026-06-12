import { ALL_CARDS } from "@/lib/hiragana";

const ROMAJI_BY_KANA = new Map(ALL_CARDS.map((card) => [card.k, card.r]));

/** Instant client-side romaji for flip UI; server remains source of truth for progress. */
export function lookupRomaji(kana: string): string | null {
  return ROMAJI_BY_KANA.get(kana) ?? null;
}
