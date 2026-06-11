import { ALL_CARDS, type HiraganaCard } from "@/lib/hiragana";
import type { ProgressState } from "@/lib/progress";

export function timeMultiplier(secs: number): number {
  if (secs < 1.5) return 1.5;
  if (secs < 3) return 1.0;
  if (secs < 5) return 0.7;
  if (secs < 8) return 0.4;
  return 0.2;
}

export function weightedPick(
  cards: HiraganaCard[],
  progress: ProgressState,
): HiraganaCard {
  const weights = cards.map((card) => {
    const score = progress.scores[card.k] ?? 4;
    const avgTime = progress.avgTimes[card.k];
    const speedPenalty =
      avgTime == null ? 0 : Math.min((avgTime - 1.5) / 6.5, 1);
    const mastery = Math.pow(score, 1.5);
    return Math.max(0.04, (1 + speedPenalty * 0.6) / mastery);
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cards[i];
  }

  return cards[cards.length - 1];
}

export function buildDeck(
  cards: HiraganaCard[],
  progress: ProgressState,
): HiraganaCard[] {
  const size = Math.min(Math.max(cards.length, 5), 25);
  const round: HiraganaCard[] = [];
  let last: HiraganaCard | null = null;

  for (let i = 0; i < size; i++) {
    const candidates =
      cards.length > 1 && last
        ? cards.filter((card) => card.k !== last!.k)
        : cards;
    const picked = weightedPick(candidates, progress);
    round.push({ ...picked });
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
