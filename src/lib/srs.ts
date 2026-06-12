import { ALL_CARDS, type HiraganaCard } from "@/lib/hiragana";
import type { ProgressState } from "@/lib/progress";

export function timeMultiplier(secs: number): number {
  if (secs < 1.5) return 1.5;
  if (secs < 3) return 1.0;
  if (secs < 5) return 0.7;
  if (secs < 8) return 0.4;
  return 0.2;
}

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
    const candidates = deckCandidates(
      cards,
      progress,
      last,
      usedInRound,
      i,
    );
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

export type AnswerResult = {
  progress: ProgressState;
  sessionStreak: number;
  sessionCorrect: number;
  reinserted: boolean;
  masteryLevel: number;
  dotStatus: "good" | "mid" | "bad";
};

export function applyAnswer(
  progress: ProgressState,
  kana: string,
  correct: boolean,
  recallTime: number,
  sessionStreak: number,
  sessionCorrect: number,
): AnswerResult {
  const next: ProgressState = {
    ...progress,
    scores: { ...progress.scores },
    avgTimes: { ...progress.avgTimes },
    allTimeSeen: { ...progress.allTimeSeen },
  };

  const clampedRecall = Math.min(Math.max(recallTime, 0), 60);
  const multiplier = timeMultiplier(clampedRecall);
  let reinserted = false;
  let dotStatus: "good" | "mid" | "bad" = "bad";
  let nextStreak = sessionStreak;
  let nextCorrect = sessionCorrect;

  if (correct) {
    const updated = Math.min(8, (next.scores[kana] ?? 4) + multiplier);
    next.scores[kana] = updated;
    dotStatus = updated >= 6 ? "good" : "mid";
    nextStreak = sessionStreak + 1;
    nextCorrect = sessionCorrect + 1;
    next.totalCorrect += 1;
    if (nextStreak > next.bestStreak) next.bestStreak = nextStreak;
  } else {
    next.scores[kana] = Math.max(1, (next.scores[kana] ?? 4) - 2);
    dotStatus = "bad";
    nextStreak = 0;
    reinserted = true;
  }

  next.totalAnswers += 1;
  next.totalRecallTime += clampedRecall;
  next.allTimeSeen[kana] = (next.allTimeSeen[kana] || 0) + 1;

  const alpha = 0.3;
  next.avgTimes[kana] =
    next.avgTimes[kana] == null
      ? clampedRecall
      : next.avgTimes[kana]! * (1 - alpha) + clampedRecall * alpha;

  return {
    progress: next,
    sessionStreak: nextStreak,
    sessionCorrect: nextCorrect,
    reinserted,
    masteryLevel: next.scores[kana],
    dotStatus,
  };
}

export function countMastered(progress: ProgressState): number {
  return Object.values(progress.scores).filter((score) => score >= 7).length;
}

export function getMasterySummary(progress: ProgressState) {
  return ALL_CARDS.map((card) => {
    const level = Math.min(
      8,
      Math.max(0, Math.round(progress.scores[card.k] ?? 4)),
    );
    const avgTime = progress.avgTimes[card.k];
    return {
      k: card.k,
      r: card.r,
      group: card.group,
      level,
      avgTime,
    };
  });
}
