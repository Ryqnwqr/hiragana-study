import { getAllCards, type SyllabaryMode } from "@/lib/syllabary";
import {
  createDefaultProgress,
  normalizeProgress,
  type ActiveRound,
  type AppSession,
  type DualProgress,
  type ProgressState,
} from "@/lib/progress";
import { compactMode, expandCompactMode } from "@/lib/syllabary";

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
  m?: "h" | "k";
  ph: CompactProgress;
  pk?: CompactProgress;
  r: CompactRound | null;
  /** @deprecated Legacy single-script payload */
  p?: CompactProgress;
};

export type CloudProgressPayload = {
  ph: CompactProgress;
  pk?: CompactProgress;
  /** @deprecated Legacy hiragana-only payload */
  s?: number[];
};

function kanaIndexMap(mode: SyllabaryMode) {
  return new Map(getAllCards(mode).map((card, index) => [card.k, index]));
}

function defaultCompactProgress(mode: SyllabaryMode): CompactProgress {
  return compressProgressForMode(createDefaultProgress(mode), mode);
}

export function compressProgressForMode(
  progress: ProgressState,
  mode: SyllabaryMode,
): CompactProgress {
  const normalized = normalizeProgress(progress, mode);
  const cards = getAllCards(mode);

  return {
    s: cards.map((card) => normalized.scores[card.k] ?? 4),
    t: cards.map((card) => normalized.avgTimes[card.k] ?? null),
    ta: normalized.totalAnswers,
    tc: normalized.totalCorrect,
    bs: normalized.bestStreak,
    trt: normalized.totalRecallTime,
    seen: cards.map((card) => normalized.allTimeSeen[card.k] ?? 0),
  };
}

export function isCompactProgress(
  value: unknown,
): value is CompactProgress {
  return (
    typeof value === "object" &&
    value != null &&
    Array.isArray((value as CompactProgress).s)
  );
}

export function isCloudProgressPayload(
  value: unknown,
): value is CloudProgressPayload {
  if (typeof value !== "object" || value == null) return false;
  if ("ph" in value) {
    return isCompactProgress((value as CloudProgressPayload).ph);
  }
  return isCompactProgress(value);
}

export function expandProgressForMode(
  compact: CompactProgress,
  mode: SyllabaryMode,
): ProgressState {
  const scores: Record<string, number> = {};
  const avgTimes: Record<string, number | null> = {};
  const allTimeSeen: Record<string, number> = {};
  const scoreList = compact.s ?? [];
  const timeList = compact.t ?? [];
  const seenList = compact.seen ?? [];

  getAllCards(mode).forEach((card, index) => {
    scores[card.k] = scoreList[index] ?? 4;
    avgTimes[card.k] = timeList[index] ?? null;
    if (seenList[index]) allTimeSeen[card.k] = seenList[index];
  });

  return normalizeProgress(
    {
      scores,
      avgTimes,
      totalAnswers: compact.ta ?? 0,
      totalCorrect: compact.tc ?? 0,
      bestStreak: compact.bs ?? 0,
      allTimeSeen,
      totalRecallTime: compact.trt ?? 0,
    },
    mode,
  );
}

/** @deprecated Use compressProgressForMode */
export function compressProgress(progress: ProgressState): CompactProgress {
  return compressProgressForMode(progress, "hiragana");
}

/** @deprecated Use expandProgressForMode */
export function expandProgress(compact: CompactProgress): ProgressState {
  return expandProgressForMode(compact, "hiragana");
}

export function compressDualProgress(progress: DualProgress): CloudProgressPayload {
  return {
    ph: compressProgressForMode(progress.hiragana, "hiragana"),
    pk: compressProgressForMode(progress.katakana, "katakana"),
  };
}

export function expandDualProgress(payload: CloudProgressPayload): DualProgress {
  const hiraganaCompact = payload.ph ?? (isCompactProgress(payload) ? payload : null);
  if (!hiraganaCompact) {
    return {
      hiragana: createDefaultProgress("hiragana"),
      katakana: createDefaultProgress("katakana"),
    };
  }

  return {
    hiragana: expandProgressForMode(hiraganaCompact, "hiragana"),
    katakana: payload.pk
      ? expandProgressForMode(payload.pk, "katakana")
      : createDefaultProgress("katakana"),
  };
}

export function compressRound(
  round: ActiveRound,
  mode: SyllabaryMode,
): CompactRound {
  const indexMap = kanaIndexMap(mode);
  const dm: CompactRound["dm"] = {};
  for (const [kana, status] of Object.entries(round.dotMap)) {
    const index = indexMap.get(kana);
    if (index != null) dm[String(index)] = status;
  }

  return {
    id: round.id,
    g: round.group,
    d: round.deck
      .map((kana) => indexMap.get(kana))
      .filter((index): index is number => index != null),
    rv: round.revealed ? 1 : 0,
    ss: round.sessionStreak,
    sc: round.sessionCorrect,
    st: round.sessionTotal,
    srt: round.sessionRecallTotal,
    dm,
  };
}

export function expandRound(
  compact: CompactRound,
  mode: SyllabaryMode,
): ActiveRound {
  const cards = getAllCards(mode);
  const dotMap: ActiveRound["dotMap"] = {};
  for (const [index, status] of Object.entries(compact.dm)) {
    const card = cards[Number(index)];
    if (card) dotMap[card.k] = status;
  }

  return {
    id: compact.id,
    group: compact.g,
    deck: compact.d.map((index) => cards[index]?.k).filter(Boolean) as string[],
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
    m: compactMode(session.mode),
    ph: compressProgressForMode(session.progress.hiragana, "hiragana"),
    pk: compressProgressForMode(session.progress.katakana, "katakana"),
    r: session.round ? compressRound(session.round, session.mode) : null,
  };
}

export function expandSession(payload: CompactSessionPayload): AppSession {
  const mode = expandCompactMode(payload.m);
  const hiraganaSource = payload.ph ?? payload.p ?? defaultCompactProgress("hiragana");

  return {
    mode,
    progress: {
      hiragana: expandProgressForMode(hiraganaSource, "hiragana"),
      katakana: payload.pk
        ? expandProgressForMode(payload.pk, "katakana")
        : createDefaultProgress("katakana"),
    },
    round: payload.r ? expandRound(payload.r, mode) : null,
  };
}

/** Supports legacy JWT payloads that stored full progress/round objects. */
export function expandLegacyOrCompact(payload: Record<string, unknown>): AppSession {
  if (payload.ph || payload.p || (payload.r !== undefined && payload.m !== undefined)) {
    return expandSession(payload as CompactSessionPayload);
  }

  const legacyProgress = payload.progress as ProgressState | undefined;
  return {
    mode: "hiragana",
    progress: {
      hiragana: legacyProgress
        ? normalizeProgress(legacyProgress, "hiragana")
        : createDefaultProgress("hiragana"),
      katakana: createDefaultProgress("katakana"),
    },
    round: (payload.round as ActiveRound | null) ?? null,
  };
}
