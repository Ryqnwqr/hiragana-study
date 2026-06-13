import type { HiraganaCard } from "@/lib/hiragana";
import type { ProgressState } from "@/lib/progress";

/**
 * Deck *selection* — which cards a round contains and in what order. This is
 * deliberately separate from the scoring/marking in `srs.ts`: selection is
 * cheap and runs on the client too (for instant category switches), while the
 * marking maths stays server-side.
 */

/** True when a character should be studied before mastered ones. */
export function isPriorityCard(
  card: HiraganaCard,
  progress: ProgressState,
): boolean {
  const seen = progress.allTimeSeen[card.k] ?? 0;
  if (seen === 0) return true;

  const score = progress.scores[card.k] ?? 4;
  if (score < 5) return true;

  const avgTime = progress.avgTimes[card.k];
  if (avgTime != null && avgTime >= 2) return true;

  return seen >= 3 && score < 6;
}

export function cardPickWeight(
  card: HiraganaCard,
  progress: ProgressState,
  position = 0,
): number {
  const score = progress.scores[card.k] ?? 4;
  const avgTime = progress.avgTimes[card.k];
  const seen = progress.allTimeSeen[card.k] ?? 0;
  const speedPenalty =
    avgTime == null ? 0 : Math.min((avgTime - 1.5) / 6.5, 1);
  const mastery = Math.pow(score, 1.5);

  let weight = Math.max(0.04, (1 + speedPenalty * 0.6) / mastery);

  if (seen === 0) {
    weight *= 8;
  } else {
    if (score <= 3) weight *= 3.5;
    else if (score < 5) weight *= 2;
    else if (score < 6) weight *= 1.35;

    if (avgTime != null) {
      if (avgTime >= 5) weight *= 2.25;
      else if (avgTime >= 2) weight *= 1.4;
    }

    if (seen >= 3 && score < 5) weight *= 1.5;
  }

  // Front-load priority cards at the start of each round.
  if (position < 3 && isPriorityCard(card, progress)) {
    weight *= 1.75;
  }

  return weight;
}

export function weightedPick(
  cards: HiraganaCard[],
  progress: ProgressState,
  position = 0,
): HiraganaCard {
  const weights = cards.map((card) => cardPickWeight(card, progress, position));

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cards[i];
  }

  return cards[cards.length - 1];
}

function deckCandidates(
  cards: HiraganaCard[],
  progress: ProgressState,
  last: HiraganaCard | null,
  usedInRound: Set<string>,
  position: number,
): HiraganaCard[] {
  const avoidRepeat =
    cards.length > 1 && last
      ? cards.filter((card) => card.k !== last.k)
      : cards;
  const unused = avoidRepeat.filter((card) => !usedInRound.has(card.k));
  const priorityUnused = unused.filter((card) =>
    isPriorityCard(card, progress),
  );

  if (priorityUnused.length > 0) {
    return priorityUnused;
  }

  if (unused.length > 0 && position < Math.ceil(avoidRepeat.length * 0.65)) {
    return unused;
  }

  return avoidRepeat;
}

export function buildDeck(
  cards: HiraganaCard[],
  progress: ProgressState,
): HiraganaCard[] {
  const size = Math.min(Math.max(cards.length, 5), 25);
  const round: HiraganaCard[] = [];
  const usedInRound = new Set<string>();
  let last: HiraganaCard | null = null;

  for (let i = 0; i < size; i++) {
    const candidates = deckCandidates(cards, progress, last, usedInRound, i);
    const picked = weightedPick(candidates, progress, i);
    round.push({ ...picked });
    usedInRound.add(picked.k);
    last = picked;
  }

  return round;
}

export function shuffleDeck(deck: HiraganaCard[]): HiraganaCard[] {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
