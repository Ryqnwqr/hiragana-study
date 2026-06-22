import {
  ALL_CARDS as HIRAGANA_CARDS,
  ALL_GROUP,
  GROUP_NAMES,
  GROUPS,
  type HiraganaCard,
} from "@/lib/hiragana";

export { ALL_GROUP };

export type SyllabaryMode = "hiragana" | "katakana";
export type KanaCard = HiraganaCard;

function toKatakana(kana: string): string {
  return [...kana]
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp >= 0x3041 && cp <= 0x3096) {
        return String.fromCodePoint(cp + 0x60);
      }
      return ch;
    })
    .join("");
}

const KATAKANA_GROUPS = Object.fromEntries(
  Object.entries(GROUPS).map(([name, cards]) => [
    name,
    cards.map((card) => ({ k: toKatakana(card.k), r: card.r })),
  ]),
);

const KATAKANA_CARDS: KanaCard[] = GROUP_NAMES.flatMap((group) =>
  KATAKANA_GROUPS[group].map((card) => ({ ...card, group })),
);

export function getAllCards(mode: SyllabaryMode): KanaCard[] {
  return mode === "hiragana" ? HIRAGANA_CARDS : KATAKANA_CARDS;
}

export function getCardsForGroup(group: string, mode: SyllabaryMode): KanaCard[] {
  if (group === ALL_GROUP) return getAllCards(mode);
  const source = mode === "hiragana" ? GROUPS : KATAKANA_GROUPS;
  const cards = source[group];
  if (!cards) return [];
  return cards.map((card) => ({ ...card, group }));
}

export function getGroupNames(mode: SyllabaryMode): string[] {
  return [ALL_GROUP, ...GROUP_NAMES];
}

export function getRomaji(kana: string, mode: SyllabaryMode): string | null {
  const card = getAllCards(mode).find((c) => c.k === kana);
  return card?.r ?? null;
}

export function modeLabel(mode: SyllabaryMode): string {
  return mode === "hiragana" ? "ひらがな" : "カタカナ";
}

export function modeShortLabel(mode: SyllabaryMode): string {
  return mode === "hiragana" ? "Hiragana" : "Katakana";
}

export function parseSyllabaryMode(value: unknown): SyllabaryMode {
  return value === "katakana" ? "katakana" : "hiragana";
}

export function compactMode(mode: SyllabaryMode): "h" | "k" {
  return mode === "katakana" ? "k" : "h";
}

export function expandCompactMode(value: unknown): SyllabaryMode {
  return value === "k" ? "katakana" : "hiragana";
}
