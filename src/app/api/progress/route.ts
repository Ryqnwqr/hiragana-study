import { NextResponse } from "next/server";

import { buildProgressResponse } from "@/lib/progress-response";
import { resetAllProgress, readPlaySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readPlaySession();
  return NextResponse.json(buildProgressResponse(session.progress));
}

export async function DELETE() {
  try {
    const session = await resetAllProgress();
    return NextResponse.json(buildProgressResponse(session.progress));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
