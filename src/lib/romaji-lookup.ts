import { getAllCards, type SyllabaryMode } from "@/lib/syllabary";

const ROMAJI_BY_MODE: Record<SyllabaryMode, Map<string, string>> = {
  hiragana: new Map(getAllCards("hiragana").map((card) => [card.k, card.r])),
  katakana: new Map(getAllCards("katakana").map((card) => [card.k, card.r])),
};

/** Instant client-side romaji for flip UI; server remains source of truth for progress. */
export function lookupRomaji(kana: string, mode: SyllabaryMode): string | null {
  return ROMAJI_BY_MODE[mode].get(kana) ?? null;
}
