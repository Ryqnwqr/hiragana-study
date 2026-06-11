import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  deckToPublicCards,
  startRound,
} from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { group?: string };
  const group = body.group || "All";

  const session = await readSession();
  const nextSession = startRound(session, group);
  await writeSession(nextSession);

  const round = nextSession.round!;

  return NextResponse.json({
    ...buildRoundSnapshot(nextSession, true),
    dotMap: round.dotMap,
    deck: deckToPublicCards(round),
  });
}
