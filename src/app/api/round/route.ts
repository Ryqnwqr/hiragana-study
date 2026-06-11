import { NextResponse } from "next/server";
import {
  buildRoundSnapshot,
  startRound,
} from "@/lib/round-service";
import { readSession, writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { group?: string };
  const group = body.group || "All";

  const session = await readSession();
  const nextSession = startRound(session, group);
  await writeSession(nextSession);

  return NextResponse.json({
    ...buildRoundSnapshot(nextSession, true),
    dotMap: nextSession.round?.dotMap ?? {},
  });
}
