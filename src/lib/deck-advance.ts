type DeckCard = { k: string; group: string };

/** Deterministic reinsert slot — must match server logic in submitAnswer. */
export function getReinsertIndex(deckLength: number, kana: string): number {
  let hash = 0;
  for (let i = 0; i < kana.length; i++) {
    hash = (hash + kana.charCodeAt(i) * (i + 1)) % 997;
  }
  return Math.min(deckLength, 2 + (hash % 3));
}

export function advancePublicDeck(
  deck: DeckCard[],
  kana: string,
  correct: boolean,
): DeckCard[] {
  if (deck[0]?.k !== kana) return deck;

  const answered = deck[0];
  const next = deck.slice(1);

  if (!correct) {
    const insertAt = getReinsertIndex(next.length, kana);
    next.splice(insertAt, 0, answered);
  }

  return next;
}
