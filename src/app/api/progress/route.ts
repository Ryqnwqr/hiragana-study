import { NextResponse } from "next/server";

import { saveCloudProgress } from "@/lib/cloud-progress";
import {
  createDefaultProgress,
  getSessionProgress,
  type AppSession,
} from "@/lib/progress";
import { buildProgressResponse } from "@/lib/progress-response";
import { readPlaySession, writeCookieSession } from "@/lib/session";
import { createClientWithTokens } from "@/lib/supabase/authed-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readPlaySession();
  const progress = getSessionProgress(session);
  return NextResponse.json({
    mode: session.mode,
    ...buildProgressResponse(progress, session.mode),
  });
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const tokens =
      typeof body.access_token === "string" && typeof body.refresh_token === "string"
        ? { access_token: body.access_token, refresh_token: body.refresh_token }
        : null;

    let supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();
    if (!user && tokens) {
      supabase = await createClientWithTokens(tokens);
      ({ data: { user } } = await supabase.auth.getUser());
    }

    const current = await readPlaySession();
    const session: AppSession = {
      ...current,
      progress: {
        ...current.progress,
        [current.mode]: createDefaultProgress(current.mode),
      },
      round: null,
    };

    if (user) {
      await saveCloudProgress(supabase, user.id, session.progress);
    }

    await writeCookieSession(session, { guest: !user });

    const progress = getSessionProgress(session);
    return NextResponse.json({
      mode: session.mode,
      ...buildProgressResponse(progress, session.mode),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
