import { NextResponse } from "next/server";
import { buildRoundSnapshot, shuffleActiveRound } from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

export async function POST() {
  const session = await readSession();
  if (!session.round) {
    return NextResponse.json({ error: "No active round" }, { status: 400 });
  }

  const nextSession = shuffleActiveRound(session);
  await writeSession(nextSession);

  return NextResponse.json({
    snapshot: buildRoundSnapshot(nextSession),
    dotMap: nextSession.round?.dotMap ?? {},
  });
}
