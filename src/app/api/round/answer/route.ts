import { NextResponse } from "next/server";
import { buildRoundSnapshot, submitAnswer } from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

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

  const session = await readSession();

  try {
    const { session: nextSession, reinserted, confetti } = submitAnswer(
      session,
      body.kana,
      body.correct,
      recallTime,
    );
    await writeSession(nextSession);

    const snapshot = buildRoundSnapshot(nextSession, false);

    return NextResponse.json({
      reinserted,
      confetti,
      snapshot,
      dotMap: nextSession.round?.dotMap ?? {},
      roundComplete: !nextSession.round?.deck.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Answer failed" },
      { status: 400 },
    );
  }
}
