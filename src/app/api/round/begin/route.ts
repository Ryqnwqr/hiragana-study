import { NextResponse } from "next/server";
import { buildRoundSnapshot } from "@/lib/round-service";
import { readPlaySession, writePlaySession } from "@/lib/session";

export async function POST() {
  const session = await readPlaySession();
  if (!session.round?.deck.length) {
    return NextResponse.json({ error: "No active round" }, { status: 400 });
  }

  await writePlaySession(session);

  return NextResponse.json({
    snapshot: buildRoundSnapshot(session),
    dotMap: session.round.dotMap,
  });
}
