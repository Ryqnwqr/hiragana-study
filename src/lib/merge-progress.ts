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
    const totalSeen = localSeen + remoteSeen;
    if (totalSeen > 0) merged.allTimeSeen[kana] = totalSeen;

    const localTime = local.avgTimes[kana];
    const remoteTime = remote.avgTimes[kana];
    if (localTime == null && remoteTime == null) {
      merged.avgTimes[kana] = null;
    } else {
      merged.avgTimes[kana] =
        ((localTime ?? 0) * localSeen + (remoteTime ?? 0) * remoteSeen) /
        Math.max(totalSeen, 1);
    }
  }

  return normalizeProgress({
    ...merged,
    totalAnswers: local.totalAnswers + remote.totalAnswers,
    totalCorrect: local.totalCorrect + remote.totalCorrect,
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    totalRecallTime: local.totalRecallTime + remote.totalRecallTime,
  });
}
