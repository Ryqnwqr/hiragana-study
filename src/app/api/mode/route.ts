import { NextResponse } from "next/server";

import { buildProgressResponse } from "@/lib/progress-response";
import { getSessionProgress, type AppSession } from "@/lib/progress";
import { readPlaySession, writePlaySession } from "@/lib/session";
import { getGroupNames, parseSyllabaryMode } from "@/lib/syllabary";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readPlaySession();
  return NextResponse.json({
    mode: session.mode,
    groups: getGroupNames(session.mode),
    ...buildProgressResponse(getSessionProgress(session), session.mode),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: unknown;
    };
    const mode = parseSyllabaryMode(body.mode);

    const session = await readPlaySession();
    const next: AppSession = {
      ...session,
      mode,
      round: null,
    };

    await writePlaySession(next, { skipCloud: true });

    return NextResponse.json({
      mode,
      groups: getGroupNames(mode),
      ...buildProgressResponse(getSessionProgress(next), mode),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to switch mode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
