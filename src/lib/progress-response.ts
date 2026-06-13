import type { ProgressState } from "@/lib/progress";
import { countMastered, getMasterySummary } from "@/lib/srs";

export function buildProgressResponse(progress: ProgressState) {
  const total = progress.totalAnswers;
  const correct = progress.totalCorrect;
  // Recall time is only logged on correct answers, so average over correct ones.
  const avgRecall = correct > 0 ? progress.totalRecallTime / correct : null;

  return {
    totalAnswers: total,
    accuracy:
      total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
    bestStreak: progress.bestStreak,
    avgRecall,
    masteredCount: countMastered(progress),
    mastery: getMasterySummary(progress),
    // Raw per-card signals so the client can build the next deck locally for an
    // instant category switch. This is the learner's own data — not the scoring.
    weights: {
      scores: progress.scores,
      avgTimes: progress.avgTimes,
      allTimeSeen: progress.allTimeSeen,
    },
    welcome: {
      mastered: countMastered(progress),
      accuracy:
        total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
      bestStreak: progress.bestStreak,
      avgRecall,
      hasProgress: total > 0,
    },
  };
}
