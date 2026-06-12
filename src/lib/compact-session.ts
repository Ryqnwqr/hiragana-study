import { ALL_CARDS } from "@/lib/hiragana";
import {
  createDefaultProgress,
  normalizeProgress,
  type ActiveRound,
  type AppSession,
  type ProgressState,
} from "@/lib/progress";

const KANA_TO_INDEX = new Map(ALL_CARDS.map((card, index) => [card.k, index]));

export type CompactProgress = {
  s: number[];
  t: (number | null)[];
  ta: number;
  tc: number;
  bs: number;
  trt: number;
  seen: number[];
};

type CompactRound = {
  id: string;
  g: string;
  d: number[];
  rv: 0 | 1;
  ss: number;
  sc: number;
  st: number;
  srt: number;
  dm: Record<string, "unseen" | "seen" | "good" | "mid" | "bad">;
};

export type CompactSessionPayload = {
  p: CompactProgress;
  r: CompactRound | null;
};

function defaultCompactProgress(): CompactProgress {
  const base = createDefaultProgress();
  return compressProgress(base);
}

export function compressProgress(progress: ProgressState): CompactProgress {
  const normalized = normalizeProgress(progress);

  return {
    s: ALL_CARDS.map((card) => normalized.scores[card.k] ?? 4),
    t: ALL_CARDS.map((card) => normalized.avgTimes[card.k] ?? null),
    ta: normalized.totalAnswers,
    tc: normalized.totalCorrect,
    bs: normalized.bestStreak,
    trt: normalized.totalRecallTime,
    seen: ALL_CARDS.map((card) => normalized.allTimeSeen[card.k] ?? 0),
  };
}

export function expandProgress(compact: CompactProgress): ProgressState {
  const scores: Record<string, number> = {};
  const avgTimes: Record<string, number | null> = {};
  const allTimeSeen: Record<string, number> = {};

  ALL_CARDS.forEach((card, index) => {
    scores[card.k] = compact.s[index] ?? 4;
    avgTimes[card.k] = compact.t[index] ?? null;
    if (compact.seen[index]) allTimeSeen[card.k] = compact.seen[index];
  });

  return normalizeProgress({
    scores,
    avgTimes,
    totalAnswers: compact.ta,
    totalCorrect: compact.tc,
    bestStreak: compact.bs,
    allTimeSeen,
    totalRecallTime: compact.trt,
  });
}

export function compressRound(round: ActiveRound): CompactRound {
  const dm: CompactRound["dm"] = {};
  for (const [kana, status] of Object.entries(round.dotMap)) {
    const index = KANA_TO_INDEX.get(kana);
    if (index != null) dm[String(index)] = status;
  }

  return {
    id: round.id,
    g: round.group,
    d: round.deck
      .map((kana) => KANA_TO_INDEX.get(kana))
      .filter((index): index is number => index != null),
    rv: round.revealed ? 1 : 0,
    ss: round.sessionStreak,
    sc: round.sessionCorrect,
    st: round.sessionTotal,
    srt: round.sessionRecallTotal,
    dm,
  };
}

export function expandRound(compact: CompactRound): ActiveRound {
  const dotMap: ActiveRound["dotMap"] = {};
  for (const [index, status] of Object.entries(compact.dm)) {
    const card = ALL_CARDS[Number(index)];
    if (card) dotMap[card.k] = status;
  }

  return {
    id: compact.id,
    group: compact.g,
    deck: compact.d.map((index) => ALL_CARDS[index]?.k).filter(Boolean) as string[],
    revealed: compact.rv === 1,
    sessionStreak: compact.ss,
    sessionCorrect: compact.sc,
    sessionTotal: compact.st,
    sessionRecallTotal: compact.srt,
    dotMap,
  };
}

export function compressSession(session: AppSession): CompactSessionPayload {
  return {
    p: compressProgress(session.progress),
    r: session.round ? compressRound(session.round) : null,
  };
}

export function expandSession(payload: CompactSessionPayload): AppSession {
  return {
    progress: expandProgress(payload.p ?? defaultCompactProgress()),
    round: payload.r ? expandRound(payload.r) : null,
  };
}

/** Supports legacy JWT payloads that stored full progress/round objects. */
export function expandLegacyOrCompact(payload: Record<string, unknown>): AppSession {
  if (payload.p && payload.r !== undefined) {
    return expandSession(payload as CompactSessionPayload);
  }

  return {
    progress: normalizeProgress(payload.progress as ProgressState),
    round: (payload.round as ActiveRound | null) ?? null,
  };
}
