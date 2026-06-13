import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  deckToPublicCards,
  startRound,
  startRoundWithDeck,
} from "@/lib/round-service";
import { readPlaySession, writePlaySession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    group?: string;
    roundId?: string;
    deck?: unknown;
  };
  const group = body.group || "All";
  const clientDeck = Array.isArray(body.deck)
    ? body.deck.filter((kana): kana is string => typeof kana === "string")
    : null;

  const session = await readPlaySession();
  // Prefer the deck the client already rendered so the switch stays instant and
  // server/client decks never diverge; otherwise build one server-side.
  const nextSession =
    clientDeck && clientDeck.length
      ? startRoundWithDeck(session, group, body.roundId, clientDeck)
      : startRound(session, group);
  // Round registration only changes round state, not progress — skip cloud write.
  await writePlaySession(nextSession, { skipCloud: true });

  const round = nextSession.round!;

  return NextResponse.json({
    ...buildRoundSnapshot(nextSession, true),
    dotMap: round.dotMap,
    deck: deckToPublicCards(round),
  });
}
