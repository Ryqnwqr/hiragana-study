import { NextResponse } from "next/server";
import { getRomaji } from "@/lib/hiragana";
import { buildRoundSnapshot, revealCurrentCard } from "@/lib/round-service";
import { readPlaySession, writePlaySession } from "@/lib/session";

export async function POST() {
  const session = await readPlaySession();
  const round = session.round;

  if (!round?.deck.length) {
    return NextResponse.json({ error: "No active card" }, { status: 400 });
  }

  const kana = round.deck[0];

  try {
    if (round.revealed) {
      const romaji = getRomaji(kana);
      if (!romaji) {
        return NextResponse.json({ error: "Unknown character" }, { status: 400 });
      }

      return NextResponse.json({
        romaji,
        snapshot: buildRoundSnapshot(session),
        dotMap: round.dotMap,
      });
    }

    const { session: nextSession, romaji } = revealCurrentCard(session);
    await writePlaySession(nextSession);

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
