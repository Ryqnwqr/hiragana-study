export type HiraganaCard = {
  k: string;
  r: string;
  group: string;
};

export const GROUPS: Record<string, Array<{ k: string; r: string }>> = {
  Vowels: [
    { k: "あ", r: "a" },
    { k: "い", r: "i" },
    { k: "う", r: "u" },
    { k: "え", r: "e" },
    { k: "お", r: "o" },
  ],
  K: [
    { k: "か", r: "ka" },
    { k: "き", r: "ki" },
    { k: "く", r: "ku" },
    { k: "け", r: "ke" },
    { k: "こ", r: "ko" },
  ],
  S: [
    { k: "さ", r: "sa" },
    { k: "し", r: "shi" },
    { k: "す", r: "su" },
    { k: "せ", r: "se" },
    { k: "そ", r: "so" },
  ],
  T: [
    { k: "た", r: "ta" },
    { k: "ち", r: "chi" },
    { k: "つ", r: "tsu" },
    { k: "て", r: "te" },
    { k: "と", r: "to" },
  ],
  N: [
    { k: "な", r: "na" },
    { k: "に", r: "ni" },
    { k: "ぬ", r: "nu" },
    { k: "ね", r: "ne" },
    { k: "の", r: "no" },
  ],
  H: [
    { k: "は", r: "ha" },
    { k: "ひ", r: "hi" },
    { k: "ふ", r: "fu" },
    { k: "へ", r: "he" },
    { k: "ほ", r: "ho" },
  ],
  M: [
    { k: "ま", r: "ma" },
    { k: "み", r: "mi" },
    { k: "む", r: "mu" },
    { k: "め", r: "me" },
    { k: "も", r: "mo" },
  ],
  Y: [
    { k: "や", r: "ya" },
    { k: "ゆ", r: "yu" },
    { k: "よ", r: "yo" },
  ],
  R: [
    { k: "ら", r: "ra" },
    { k: "り", r: "ri" },
    { k: "る", r: "ru" },
    { k: "れ", r: "re" },
    { k: "ろ", r: "ro" },
  ],
  "W+N": [
    { k: "わ", r: "wa" },
    { k: "を", r: "wo" },
    { k: "ん", r: "n" },
  ],
  Dakuten: [
    { k: "が", r: "ga" },
    { k: "ぎ", r: "gi" },
    { k: "ぐ", r: "gu" },
    { k: "げ", r: "ge" },
    { k: "ご", r: "go" },
    { k: "ざ", r: "za" },
    { k: "じ", r: "ji" },
    { k: "ず", r: "zu" },
    { k: "ぜ", r: "ze" },
    { k: "ぞ", r: "zo" },
    { k: "だ", r: "da" },
    { k: "ぢ", r: "di" },
    { k: "づ", r: "du" },
    { k: "で", r: "de" },
    { k: "ど", r: "do" },
    { k: "ば", r: "ba" },
    { k: "び", r: "bi" },
    { k: "ぶ", r: "bu" },
    { k: "べ", r: "be" },
    { k: "ぼ", r: "bo" },
  ],
  Handakuten: [
    { k: "ぱ", r: "pa" },
    { k: "ぴ", r: "pi" },
    { k: "ぷ", r: "pu" },
    { k: "ぺ", r: "pe" },
    { k: "ぽ", r: "po" },
  ],
  Combos: [
    { k: "きゃ", r: "kya" },
    { k: "きゅ", r: "kyu" },
    { k: "きょ", r: "kyo" },
    { k: "しゃ", r: "sha" },
    { k: "しゅ", r: "shu" },
    { k: "しょ", r: "sho" },
    { k: "ちゃ", r: "cha" },
    { k: "ちゅ", r: "chu" },
    { k: "ちょ", r: "cho" },
    { k: "にゃ", r: "nya" },
    { k: "にゅ", r: "nyu" },
    { k: "にょ", r: "nyo" },
    { k: "ひゃ", r: "hya" },
    { k: "ひゅ", r: "hyu" },
    { k: "ひょ", r: "hyo" },
    { k: "みゃ", r: "mya" },
    { k: "みゅ", r: "myu" },
    { k: "みょ", r: "myo" },
    { k: "りゃ", r: "rya" },
    { k: "りゅ", r: "ryu" },
    { k: "りょ", r: "ryo" },
    { k: "ぎゃ", r: "gya" },
    { k: "ぎゅ", r: "gyu" },
    { k: "ぎょ", r: "gyo" },
    { k: "じゃ", r: "ja" },
    { k: "じゅ", r: "ju" },
    { k: "じょ", r: "jo" },
    { k: "びゃ", r: "bya" },
    { k: "びゅ", r: "byu" },
    { k: "びょ", r: "byo" },
    { k: "ぴゃ", r: "pya" },
    { k: "ぴゅ", r: "pyu" },
    { k: "ぴょ", r: "pyo" },
  ],
};

export const GROUP_NAMES = Object.keys(GROUPS);
export const ALL_GROUP = "All";

export const ALL_CARDS: HiraganaCard[] = GROUP_NAMES.flatMap((group) =>
  GROUPS[group].map((card) => ({ ...card, group })),
);

export function getCardsForGroup(group: string): HiraganaCard[] {
  if (group === ALL_GROUP) return ALL_CARDS;
  const cards = GROUPS[group];
  if (!cards) return [];
  return cards.map((card) => ({ ...card, group }));
}

export function getRomaji(kana: string): string | null {
  const card = ALL_CARDS.find((c) => c.k === kana);
  return card?.r ?? null;
}

export function getGroupNames(): string[] {
  return [ALL_GROUP, ...GROUP_NAMES];
}
