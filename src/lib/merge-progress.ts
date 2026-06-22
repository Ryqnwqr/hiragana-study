import { getAllCards, type SyllabaryMode } from "@/lib/syllabary";
import {
  createDefaultDualProgress,
  createDefaultProgress,
  normalizeProgress,
  type DualProgress,
  type ProgressState,
} from "@/lib/progress";

export function mergeProgress(
  local: ProgressState,
  remote: ProgressState,
  mode: SyllabaryMode,
): ProgressState {
  const merged = createDefaultProgress(mode);

  for (const card of getAllCards(mode)) {
    const kana = card.k;

    const localSeen = local.allTimeSeen[kana] ?? 0;
    const remoteSeen = remote.allTimeSeen[kana] ?? 0;
    const totalSeen = Math.max(localSeen, remoteSeen);
    if (totalSeen > 0) merged.allTimeSeen[kana] = totalSeen;

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
      merged.avgTimes[kana] =
        localSeen >= remoteSeen ? localTime : remoteTime;
    }
  }

  return normalizeProgress(
    {
      ...merged,
      totalAnswers: Math.max(local.totalAnswers, remote.totalAnswers),
      totalCorrect: Math.max(local.totalCorrect, remote.totalCorrect),
      bestStreak: Math.max(local.bestStreak, remote.bestStreak),
      totalRecallTime: Math.max(local.totalRecallTime, remote.totalRecallTime),
    },
    mode,
  );
}

export function mergeDualProgress(
  local: DualProgress,
  remote: DualProgress,
): DualProgress {
  return {
    hiragana: mergeProgress(local.hiragana, remote.hiragana, "hiragana"),
    katakana: mergeProgress(local.katakana, remote.katakana, "katakana"),
  };
}

export function emptyDualProgress(): DualProgress {
  return createDefaultDualProgress();
}
