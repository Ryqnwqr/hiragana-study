import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  deckToPublicCards,
  submitAnswer,
} from "@/lib/round-service";
import { readPlaySession, writePlaySession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    kana?: string;
    correct?: boolean;
    recallTime?: number;
  };

  if (!body.kana || typeof body.correct !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const recallTime =
    typeof body.recallTime === "number" && Number.isFinite(body.recallTime)
      ? body.recallTime
      : 0;

  const session = await readPlaySession();

  try {
    const { session: nextSession, reinserted, confetti } = submitAnswer(
      session,
      body.kana,
      body.correct,
      recallTime,
    );
    await writePlaySession(nextSession);

    const snapshot = buildRoundSnapshot(nextSession, false);

    const round = nextSession.round;

    return NextResponse.json({
      reinserted,
      confetti,
      snapshot,
      dotMap: round?.dotMap ?? {},
      deck: round ? deckToPublicCards(round) : [],
      roundComplete: !round?.deck.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Answer failed" },
      { status: 400 },
    );
  }
}
