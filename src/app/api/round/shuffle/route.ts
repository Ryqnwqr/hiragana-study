import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  deckToPublicCards,
  shuffleActiveRound,
} from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

export async function POST() {
  const session = await readSession();
  if (!session.round) {
    return NextResponse.json({ error: "No active round" }, { status: 400 });
  }

  const nextSession = shuffleActiveRound(session);
  await writeSession(nextSession);

  const round = nextSession.round!;

  return NextResponse.json({
    snapshot: buildRoundSnapshot(nextSession),
    dotMap: round.dotMap,
    deck: deckToPublicCards(round),
  });
}
