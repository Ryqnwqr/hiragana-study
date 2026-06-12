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
    merged.scores[kana] = Math.max(
      local.scores[kana] ?? 4,
      remote.scores[kana] ?? 4,
    );

    const localSeen = local.allTimeSeen[kana] ?? 0;
    const remoteSeen = remote.allTimeSeen[kana] ?? 0;
    const totalSeen = Math.max(localSeen, remoteSeen);
    if (totalSeen > 0) merged.allTimeSeen[kana] = totalSeen;

    const localTime = local.avgTimes[kana];
    const remoteTime = remote.avgTimes[kana];
    if (localTime == null && remoteTime == null) {
      merged.avgTimes[kana] = null;
    } else if (localTime == null) {
      merged.avgTimes[kana] = remoteTime;
    } else if (remoteTime == null) {
      merged.avgTimes[kana] = localTime;
    } else {
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
