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
  let head = deck;
  if (deck[0]?.k !== kana) {
    const index = deck.findIndex((card) => card.k === kana);
    if (index < 0) return deck;
    head = deck.slice(index);
  }

  const answered = head[0];
  const next = head.slice(1);

  if (!correct) {
    const insertAt = getReinsertIndex(next.length, kana);
    next.splice(insertAt, 0, answered);
  }

  return next;
}
