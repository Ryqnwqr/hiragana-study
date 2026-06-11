import { NextResponse } from "next/server";
import { buildRoundSnapshot, revealCurrentCard } from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as { kana?: string };
  const session = await readSession();

  if (!session.round?.deck.length) {
    return NextResponse.json({ error: "No active card" }, { status: 400 });
  }

  if (body.kana && body.kana !== session.round.deck[0]) {
    return NextResponse.json({ error: "Card mismatch" }, { status: 400 });
  }

  try {
    const { session: nextSession, romaji } = revealCurrentCard(session);
    await writeSession(nextSession);

    return NextResponse.json({
      romaji,
      snapshot: buildRoundSnapshot(nextSession),
      dotMap: nextSession.round?.dotMap ?? {},
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reveal failed" },
      { status: 400 },
    );
  }
}
