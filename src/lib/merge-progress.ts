import { ALL_CARDS } from "@/lib/hiragana";
import {
  createDefaultProgress,
  normalizeProgress,
  type ProgressState,
} from "@/lib/progress";

export function mergeProgress(
  local: ProgressState,
  remote: ProgressState,
): ProgressState {
  const merged = createDefaultProgress();

  for (const card of ALL_CARDS) {
    const kana = card.k;

    const localSeen = local.allTimeSeen[kana] ?? 0;
    const remoteSeen = remote.allTimeSeen[kana] ?? 0;
    const totalSeen = Math.max(localSeen, remoteSeen);
    if (totalSeen > 0) merged.allTimeSeen[kana] = totalSeen;

    // The device with more reps for this card has the most up-to-date score.
    // Using Math.max ignores misses from other devices; higher-seen wins instead.
    // On a tie (equal reps from independent study) take the lower score to stay
    // conservative rather than silently promote a card that may have been missed.
    const localScore = local.scores[kana] ?? 4;
    const remoteScore = remote.scores[kana] ?? 4;
    if (localSeen > remoteSeen) {
      merged.scores[kana] = localScore;
    } else if (remoteSeen > localSeen) {
      merged.scores[kana] = remoteScore;
    } else {
      merged.scores[kana] = Math.min(localScore, remoteScore);
    }

    const localTime = local.avgTimes[kana];
    const remoteTime = remote.avgTimes[kana];
    if (localTime == null && remoteTime == null) {
      merged.avgTimes[kana] = null;
    } else if (localTime == null) {
      merged.avgTimes[kana] = remoteTime;
    } else if (remoteTime == null) {
      merged.avgTimes[kana] = localTime;
    } else {
      // avgTime from the same side as the winning score keeps the data consistent.
      merged.avgTimes[kana] =
        localSeen >= remoteSeen ? localTime : remoteTime;
    }
  }

  return normalizeProgress({
    ...merged,
    totalAnswers: Math.max(local.totalAnswers, remote.totalAnswers),
    totalCorrect: Math.max(local.totalCorrect, remote.totalCorrect),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    totalRecallTime: Math.max(local.totalRecallTime, remote.totalRecallTime),
  });
}
