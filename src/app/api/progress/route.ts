import { NextResponse } from "next/server";
import { createDefaultProgress } from "@/lib/progress";
import { countMastered, getMasterySummary } from "@/lib/srs";
import { readSession, writeSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  const { progress } = session;
  const total = progress.totalAnswers;

  return NextResponse.json({
    totalAnswers: total,
    accuracy: total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
    bestStreak: progress.bestStreak,
    avgRecall: total > 0 ? progress.totalRecallTime / total : null,
    masteredCount: countMastered(progress),
    mastery: getMasterySummary(progress),
    welcome: {
      mastered: countMastered(progress),
      accuracy: total > 0 ? Math.round((progress.totalCorrect / total) * 100) : null,
      bestStreak: progress.bestStreak,
      avgRecall: total > 0 ? progress.totalRecallTime / total : null,
      hasProgress: total > 0,
    },
  });
}

export async function DELETE() {
  const session = await readSession();
  await writeSession({
    progress: createDefaultProgress(),
    round: null,
  });

  return NextResponse.json({ ok: true, hadRound: Boolean(session.round) });
}
