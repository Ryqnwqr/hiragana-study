import { randomUUID } from "crypto";
import {
  ALL_GROUP,
  getCardsForGroup,
  getRomaji,
  type HiraganaCard,
} from "@/lib/hiragana";
import type { ActiveRound, AppSession } from "@/lib/progress";
import { applyAnswer, buildDeck, shuffleDeck } from "@/lib/srs";

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

function toPublicCard(card: HiraganaCard): PublicCard {
  return { k: card.k, group: card.group };
}

function currentCardFromRound(round: ActiveRound): PublicCard | null {
  if (!round.deck.length) return null;
  const k = round.deck[0];
  const cards = getCardsForGroup(round.group);
  const match = cards.find((card) => card.k === k);
  return match ? { k: match.k, group: match.group } : { k, group: round.group };
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
      round.sessionTotal > 0
        ? round.sessionRecallTotal / round.sessionTotal
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
  const dotMap: ActiveRound["dotMap"] = {};
  for (const card of deck) dotMap[card.k] = "unseen";

  return {
    ...session,
    round: {
      id: randomUUID(),
      group: group || ALL_GROUP,
      deck: deck.map((card) => card.k),
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
  const round = session.round;
  if (!round || !round.deck.length || !round.revealed) {
    throw new Error("No active card");
  }

  if (round.deck[0] !== kana) {
    throw new Error("Card mismatch");
  }

  const result = applyAnswer(
    session.progress,
    kana,
    correct,
    recallTime,
    round.sessionStreak,
    round.sessionCorrect,
  );

  const deck = [...round.deck];
  deck.shift();

  if (result.reinserted) {
    const insertAt = Math.min(
      deck.length,
      2 + Math.floor(Math.random() * 3),
    );
    deck.splice(insertAt, 0, kana);
  }

  const dotMap = { ...round.dotMap };
  dotMap[kana] = result.dotStatus;

  const confetti =
    correct && result.sessionStreak > 0 && result.sessionStreak % 5 === 0;

  return {
    session: {
      progress: result.progress,
      round: {
        ...round,
        deck,
        revealed: false,
        sessionStreak: result.sessionStreak,
        sessionCorrect: result.sessionCorrect,
        sessionTotal: round.sessionTotal + 1,
        sessionRecallTotal: round.sessionRecallTotal + Math.min(recallTime, 60),
        dotMap,
      },
    },
    reinserted: result.reinserted,
    confetti,
  };
}

export function shuffleActiveRound(session: AppSession): AppSession {
  const round = session.round;
  if (!round || !round.deck.length) return session;

  const cards = round.deck
    .map((kana) => getCardsForGroup(round.group).find((card) => card.k === kana))
    .filter((card): card is HiraganaCard => Boolean(card));

  const shuffled = shuffleDeck(cards);

  return {
    ...session,
    round: {
      ...round,
      deck: shuffled.map((card) => card.k),
      revealed: false,
    },
  };
}
