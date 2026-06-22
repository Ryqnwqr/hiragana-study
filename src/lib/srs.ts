import { getAllCards, type SyllabaryMode } from "@/lib/syllabary";
import type { ProgressState } from "@/lib/progress";

/**
 * Teacher-style marking. Everything below runs server-side and stays hidden —
 * the learner only ever sees the resulting mastery, never the maths. Each answer
 * nudges a card's mastery toward the quality this single performance showed,
 * weighted by how much evidence we already have for the card (its frequency), so
 * recent answers count most while well-drilled cards stay stable.
 */

const MIN_SCORE = 0;
const MAX_SCORE = 8;

export function recallQuality(secs: number): number {
  const t = Math.min(Math.max(secs, 0), 60);
  const q = 1.15 * Math.exp(-(t - 1) / 3.5);
  return Math.min(Math.max(q, 0.45), 1.15);
}

function gainRate(priorSeen: number): number {
  return Math.min(Math.max(0.62 / (1 + 0.2 * priorSeen), 0.12), 0.62);
}

function lossRate(priorSeen: number): number {
  return Math.min(Math.max(0.42 / (1 + 0.12 * priorSeen), 0.14), 0.42);
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
  const priorSeen = next.allTimeSeen[kana] ?? 0;
  const current = next.scores[kana] ?? 4;

  let reinserted = false;
  let dotStatus: "good" | "mid" | "bad" = "bad";
  let nextStreak = sessionStreak;
  let nextCorrect = sessionCorrect;
  let updated: number;

  if (correct) {
    const target = recallQuality(clampedRecall) * MAX_SCORE;
    const delta = gainRate(priorSeen) * (target - current);
    updated = current + (delta >= 0 ? delta : delta * 0.25);
    dotStatus = updated >= 6 ? "good" : "mid";
    nextStreak = sessionStreak + 1;
    nextCorrect = sessionCorrect + 1;
    next.totalCorrect += 1;
    if (nextStreak > next.bestStreak) next.bestStreak = nextStreak;
  } else {
    updated = current - lossRate(priorSeen) * current;
    dotStatus = "bad";
    nextStreak = 0;
    reinserted = true;
  }

  next.scores[kana] = Math.min(MAX_SCORE, Math.max(MIN_SCORE, updated));

  next.totalAnswers += 1;
  next.allTimeSeen[kana] = priorSeen + 1;

  if (correct) {
    next.totalRecallTime += clampedRecall;
    const alpha = 0.3;
    next.avgTimes[kana] =
      next.avgTimes[kana] == null
        ? clampedRecall
        : next.avgTimes[kana]! * (1 - alpha) + clampedRecall * alpha;
  }

  return {
    progress: next,
    sessionStreak: nextStreak,
    sessionCorrect: nextCorrect,
    reinserted,
    masteryLevel: next.scores[kana],
    dotStatus,
  };
}

export function countMastered(
  progress: ProgressState,
  mode: SyllabaryMode,
): number {
  const cards = getAllCards(mode);
  return cards.filter(
    (card) => Math.round(progress.scores[card.k] ?? 4) >= 7,
  ).length;
}

export function getMasterySummary(progress: ProgressState, mode: SyllabaryMode) {
  return getAllCards(mode).map((card) => {
    const seen = progress.allTimeSeen[card.k] ?? 0;
    const level =
      seen === 0
        ? 0
        : Math.min(8, Math.max(0, Math.round(progress.scores[card.k] ?? 4)));
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
