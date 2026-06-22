import type { ProgressState } from "@/lib/progress";
import type { SyllabaryMode } from "@/lib/syllabary";
import { countMastered, getMasterySummary } from "@/lib/srs";

export function buildProgressResponse(
  progress: ProgressState,
  mode: SyllabaryMode,
) {
  const total = progress.totalAnswers;
  const correct = progress.totalCorrect;
  const avgRecall = correct > 0 ? progress.totalRecallTime / correct : null;

  return {
    totalAnswers: total,
    accuracy:
      total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
    bestStreak: progress.bestStreak,
    avgRecall,
    masteredCount: countMastered(progress, mode),
    mastery: getMasterySummary(progress, mode),
    weights: {
      scores: progress.scores,
      avgTimes: progress.avgTimes,
      allTimeSeen: progress.allTimeSeen,
    },
    welcome: {
      mastered: countMastered(progress, mode),
      accuracy:
        total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
      bestStreak: progress.bestStreak,
      avgRecall,
      hasProgress: total > 0,
    },
  };
}
