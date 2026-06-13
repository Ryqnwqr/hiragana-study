import type { PublicCard, ProgressWeights } from "@/lib/client-api";
import { buildDeck } from "@/lib/deck-build";
import { getCardsForGroup } from "@/lib/hiragana";
import { createDefaultProgress, type ProgressState } from "@/lib/progress";

/**
 * Build a round's deck on the client so switching categories is instant. Uses
 * the same selection logic the server would; the server then stores this exact
 * deck (see `startRoundWithDeck`) so the two never diverge.
 */
export function buildLocalDeck(
  group: string,
  weights: ProgressWeights | null,
): PublicCard[] {
  const cards = getCardsForGroup(group);
  if (!cards.length) return [];

  const base = createDefaultProgress();
  const progress: ProgressState = weights
    ? {
        ...base,
        scores: { ...base.scores, ...weights.scores },
        avgTimes: { ...base.avgTimes, ...weights.avgTimes },
        allTimeSeen: { ...weights.allTimeSeen },
      }
    : base;

  return buildDeck(cards, progress).map((card) => ({
    k: card.k,
    group: card.group,
  }));
}

/** UUID with a fallback for older WebViews that lack crypto.randomUUID. */
export function makeRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
