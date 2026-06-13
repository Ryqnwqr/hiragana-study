import { ALL_CARDS } from "@/lib/hiragana";
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

/**
 * Quality of a *correct* recall, from how fast it came: ~1.15 for an instant
 * answer easing down to a 0.45 floor for a slow-but-correct one. Continuous, so
 * there are no cliff edges between "fast" and "slow".
 */
export function recallQuality(secs: number): number {
  const t = Math.min(Math.max(secs, 0), 60);
  const q = 1.15 * Math.exp(-(t - 1) / 3.5);
  return Math.min(Math.max(q, 0.45), 1.15);
}

/**
 * How hard a correct answer pulls mastery toward its target. Strong and slow to
 * fade with reps, so genuine recall is rewarded fast: a single quick correct
 * answer lifts a new card most of the way, and a card recovers convincingly
 * after an early stumble rather than stalling at the default.
 */
function gainRate(priorSeen: number): number {
  return Math.min(Math.max(0.62 / (1 + 0.2 * priorSeen), 0.12), 0.62);
}

/**
 * How hard a miss pulls mastery toward zero. Softer than the gain so a fumble
 * while still learning doesn't cancel out the recall that follows it, but two or
 * three misses still drop a card into the red. Eases further as a card proves
 * itself, so an established character survives the occasional slip.
 */
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
    // Mark toward the quality this recall demonstrated. A slow-but-correct
    // answer can ease an over-rated card down, but only gently (quarter weight)
    // so one rusty hit never un-masters a card the learner clearly knows.
    const target = recallQuality(clampedRecall) * MAX_SCORE;
    const delta = gainRate(priorSeen) * (target - current);
    updated = current + (delta >= 0 ? delta : delta * 0.25);
    dotStatus = updated >= 6 ? "good" : "mid";
    nextStreak = sessionStreak + 1;
    nextCorrect = sessionCorrect + 1;
    next.totalCorrect += 1;
    if (nextStreak > next.bestStreak) next.bestStreak = nextStreak;
  } else {
    // Even-handed: a miss pulls toward zero in proportion to how established the
    // card was, independent of how fast the miss happened.
    updated = current - lossRate(priorSeen) * current;
    dotStatus = "bad";
    nextStreak = 0;
    reinserted = true;
  }

  next.scores[kana] = Math.min(MAX_SCORE, Math.max(MIN_SCORE, updated));

  next.totalAnswers += 1;
  next.allTimeSeen[kana] = priorSeen + 1;

  // Recall *time* only counts when the answer was correct. A miss is "time to
  // give up and flip", not "time to recall" — folding it in would show a fast
  // speed on a card the learner clearly doesn't know, contradicting its low
  // mastery bar. Misses leave the speed stats untouched.
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

export function countMastered(progress: ProgressState): number {
  // Use rounded score so the mastered tally matches the level-7 bar shown in
  // the mastery grid, which also rounds before picking the bar colour.
  return Object.values(progress.scores).filter((score) => Math.round(score) >= 7).length;
}

export function getMasterySummary(progress: ProgressState) {
  return ALL_CARDS.map((card) => {
    const seen = progress.allTimeSeen[card.k] ?? 0;
    // A character you've never studied shows an empty bar (level 0), not the
    // default mid score — otherwise untouched cards look half-learned.
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
