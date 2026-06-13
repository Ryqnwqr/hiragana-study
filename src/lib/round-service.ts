import { randomUUID } from "crypto";
import {
  ALL_GROUP,
  getCardsForGroup,
  getRomaji,
} from "@/lib/hiragana";
import { getReinsertIndex } from "@/lib/deck-advance";
import { buildDeck } from "@/lib/deck-build";
import type { ActiveRound, AppSession } from "@/lib/progress";
import { applyAnswer } from "@/lib/srs";

export type PublicCard = {
  k: string;
  group: string;
};

export type RoundSnapshot = {
  roundId: string;
  group: string;
  roundSize: number;
  remaining: number;
  sessionStreak: number;
  sessionCorrect: number;
  sessionTotal: number;
  avgRecall: number | null;
  masteredCount: number;
  currentCard: PublicCard | null;
  awaitingStart: boolean;
  revealed: boolean;
  roundComplete: boolean;
};

function currentCardFromRound(round: ActiveRound): PublicCard | null {
  if (!round.deck.length) return null;
  return publicCardFromKana(round.deck[0], round.group);
}

export function publicCardFromKana(
  kana: string,
  group: string,
): PublicCard {
  const cards = getCardsForGroup(group);
  const match = cards.find((card) => card.k === kana);
  return match ? { k: match.k, group: match.group } : { k: kana, group };
}

export function deckToPublicCards(round: ActiveRound): PublicCard[] {
  return round.deck.map((kana) => publicCardFromKana(kana, round.group));
}

export function buildRoundSnapshot(
  session: AppSession,
  awaitingStart = false,
): RoundSnapshot {
  const round = session.round;
  if (!round) {
    throw new Error("No active round");
  }

  const roundSize = round.sessionTotal + round.deck.length;
  const remaining = round.deck.length;

  return {
    roundId: round.id,
    group: round.group,
    roundSize: Math.max(roundSize, 1),
    remaining,
    sessionStreak: round.sessionStreak,
    sessionCorrect: round.sessionCorrect,
    sessionTotal: round.sessionTotal,
    avgRecall:
      round.sessionCorrect > 0
        ? round.sessionRecallTotal / round.sessionCorrect
        : null,
    masteredCount: Object.values(session.progress.scores).filter(
      (score) => score >= 7,
    ).length,
    currentCard: round.deck.length ? currentCardFromRound(round) : null,
    awaitingStart,
    revealed: round.revealed,
    roundComplete: !round.deck.length && round.sessionTotal > 0 && !awaitingStart,
  };
}

export function startRound(session: AppSession, group: string): AppSession {
  const cards = getCardsForGroup(group);
  if (!cards.length) {
    throw new Error("Unknown group");
  }

  const deck = buildDeck(cards, session.progress);
  return seedRound(
    session,
    group,
    deck.map((card) => card.k),
  );
}

/**
 * Register a deck the client already built (for instant category switches).
 * Falls back to a server-built deck if the client's is empty/invalid, and
 * sanitises the kana so a tampered client can't inject unknown characters.
 */
export function startRoundWithDeck(
  session: AppSession,
  group: string,
  roundId: string | undefined,
  deckKanas: string[],
): AppSession {
  const valid = new Set(getCardsForGroup(group).map((card) => card.k));
  const deck = deckKanas.filter((kana) => valid.has(kana)).slice(0, 25);

  if (!deck.length) return startRound(session, group);

  return seedRound(session, group, deck, roundId);
}

function seedRound(
  session: AppSession,
  group: string,
  deck: string[],
  roundId?: string,
): AppSession {
  const dotMap: ActiveRound["dotMap"] = {};
  for (const kana of deck) dotMap[kana] = "unseen";

  return {
    ...session,
    round: {
      id: roundId || randomUUID(),
      group: group || ALL_GROUP,
      deck,
      revealed: false,
      sessionStreak: 0,
      sessionCorrect: 0,
      sessionTotal: 0,
      sessionRecallTotal: 0,
      dotMap,
    },
  };
}

export function revealCurrentCard(session: AppSession): {
  session: AppSession;
  romaji: string;
} {
  const round = session.round;
  if (!round || !round.deck.length) {
    throw new Error("No card to reveal");
  }

  const kana = round.deck[0];
  const romaji = getRomaji(kana);
  if (!romaji) throw new Error("Unknown character");

  const dotMap = { ...round.dotMap };
  if (dotMap[kana] === "unseen") dotMap[kana] = "seen";

  return {
    session: {
      ...session,
      round: {
        ...round,
        revealed: true,
        dotMap,
      },
    },
    romaji,
  };
}

export function submitAnswer(
  session: AppSession,
  kana: string,
  correct: boolean,
  recallTime: number,
): {
  session: AppSession;
  reinserted: boolean;
  confetti: boolean;
} {
  let workingSession = session;
  const round = workingSession.round;
  if (!round || !round.deck.length) {
    throw new Error("No active card");
  }

  // Server deck order is authoritative — client kana is only a hint.
  const actualKana = round.deck[0];

  if (!round.revealed) {
    workingSession = revealCurrentCard(workingSession).session;
  }

  const activeRound = workingSession.round!;

  const result = applyAnswer(
    workingSession.progress,
    actualKana,
    correct,
    recallTime,
    activeRound.sessionStreak,
    activeRound.sessionCorrect,
  );

  const deck = [...activeRound.deck];
  deck.shift();

  if (result.reinserted) {
    const insertAt = getReinsertIndex(deck.length, actualKana);
    deck.splice(insertAt, 0, actualKana);
  }

  const dotMap = { ...activeRound.dotMap };
  dotMap[actualKana] = result.dotStatus;

  const confetti =
    correct && result.sessionStreak > 0 && result.sessionStreak % 5 === 0;

  return {
    session: {
      progress: result.progress,
      round: {
        ...activeRound,
        deck,
        revealed: false,
        sessionStreak: result.sessionStreak,
        sessionCorrect: result.sessionCorrect,
        sessionTotal: activeRound.sessionTotal + 1,
        // Only correct answers contribute to the recall-speed average.
        sessionRecallTotal:
          activeRound.sessionRecallTotal +
          (correct ? Math.min(Math.max(recallTime, 0), 60) : 0),
        dotMap,
      },
    },
    reinserted: result.reinserted,
    confetti,
  };
}

