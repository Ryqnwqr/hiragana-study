import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  deckToPublicCards,
  shuffleActiveRound,
} from "@/lib/round-service";
import { readPlaySession, writePlaySession } from "@/lib/session";

export async function POST() {
  const session = await readPlaySession();
  if (!session.round) {
    return NextResponse.json({ error: "No active round" }, { status: 400 });
  }

  const nextSession = shuffleActiveRound(session);
  await writePlaySession(nextSession);

  const round = nextSession.round!;

  return NextResponse.json({
    snapshot: buildRoundSnapshot(nextSession),
    dotMap: round.dotMap,
    deck: deckToPublicCards(round),
  });
}
