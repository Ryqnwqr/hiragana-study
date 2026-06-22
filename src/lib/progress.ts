import { getAllCards, type SyllabaryMode } from "@/lib/syllabary";

export type { SyllabaryMode } from "@/lib/syllabary";

export type ProgressState = {
  scores: Record<string, number>;
  avgTimes: Record<string, number | null>;
  totalAnswers: number;
  totalCorrect: number;
  bestStreak: number;
  allTimeSeen: Record<string, number>;
  totalRecallTime: number;
};

export type DualProgress = Record<SyllabaryMode, ProgressState>;

export type ActiveRound = {
  id: string;
  group: string;
  deck: string[];
  revealed: boolean;
  sessionStreak: number;
  sessionCorrect: number;
  sessionTotal: number;
  sessionRecallTotal: number;
  dotMap: Record<string, "unseen" | "seen" | "good" | "mid" | "bad">;
};

export type AppSession = {
  mode: SyllabaryMode;
  progress: DualProgress;
  round: ActiveRound | null;
};

export function createDefaultProgress(mode: SyllabaryMode): ProgressState {
  const scores: Record<string, number> = {};
  const avgTimes: Record<string, number | null> = {};

  for (const card of getAllCards(mode)) {
    scores[card.k] = 4;
    avgTimes[card.k] = null;
  }

  return {
    scores,
    avgTimes,
    totalAnswers: 0,
    totalCorrect: 0,
    bestStreak: 0,
    allTimeSeen: {},
    totalRecallTime: 0,
  };
}

export function createDefaultDualProgress(): DualProgress {
  return {
    hiragana: createDefaultProgress("hiragana"),
    katakana: createDefaultProgress("katakana"),
  };
}

export function normalizeProgress(
  progress: ProgressState,
  mode: SyllabaryMode,
): ProgressState {
  const next = {
    ...progress,
    scores: { ...progress.scores },
    avgTimes: { ...(progress.avgTimes || {}) },
    allTimeSeen: { ...(progress.allTimeSeen || {}) },
  };

  for (const card of getAllCards(mode)) {
    if (next.scores[card.k] == null) next.scores[card.k] = 4;
    if (next.avgTimes[card.k] === undefined) next.avgTimes[card.k] = null;
  }

  if (!next.totalRecallTime) next.totalRecallTime = 0;
  return next;
}

export function getSessionProgress(session: AppSession): ProgressState {
  return session.progress[session.mode];
}

export function createDefaultSession(): AppSession {
  return {
    mode: "hiragana",
    progress: createDefaultDualProgress(),
    round: null,
  };
}
