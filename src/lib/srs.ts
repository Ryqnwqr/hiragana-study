import { ALL_CARDS, type HiraganaCard } from "@/lib/hiragana";
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
 * How hard a correct answer pulls mastery toward its target — eager while a card
 * is still new (few reps), fine-tuning once we have plenty of evidence.
 */
function gainRate(priorSeen: number): number {
  return Math.min(Math.max(0.55 / (1 + 0.5 * priorSeen), 0.08), 0.55);
}

/**
 * How hard a miss pulls mastery toward zero. Mistakes stay salient longer than
 * gains (slower decay, higher floor), but still soften as a card proves itself.
 */
function lossRate(priorSeen: number): number {
  return Math.min(Math.max(0.6 / (1 + 0.25 * priorSeen), 0.16), 0.6);
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
  next.totalRecallTime += clampedRecall;
  next.allTimeSeen[kana] = priorSeen + 1;

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
