import { NextResponse } from "next/server";

import { saveCloudProgress } from "@/lib/cloud-progress";
import { createDefaultProgress, type AppSession } from "@/lib/progress";
import { buildProgressResponse } from "@/lib/progress-response";
import { readPlaySession, writeCookieSession } from "@/lib/session";
import { createClientWithTokens } from "@/lib/supabase/authed-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readPlaySession();
  return NextResponse.json(buildProgressResponse(session.progress));
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const tokens =
      typeof body.access_token === "string" && typeof body.refresh_token === "string"
        ? { access_token: body.access_token, refresh_token: body.refresh_token }
        : null;

    // Authenticate the same way the sync route does: cookie-first, then fall
    // back to the request-body tokens. API routes can't rely on cookie auth in
    // production (middleware skips them), so without the token fallback we'd
    // mistake a signed-in user for a guest, clear only the cookie, and leave the
    // cloud row intact — which the next sync then merges straight back in.
    let supabase = await createClient();
    let { data: { user } } = await supabase.auth.getUser();
    if (!user && tokens) {
      supabase = await createClientWithTokens(tokens);
      ({ data: { user } } = await supabase.auth.getUser());
    }

    const session: AppSession = {
      progress: createDefaultProgress(),
      round: null,
    };

    // Clear the cloud first (when signed in) so a failure surfaces as an error
    // instead of silently leaving stale data to be restored later.
    if (user) {
      await saveCloudProgress(supabase, user.id, session.progress);
    }

    await writeCookieSession(session, { guest: !user });

    return NextResponse.json(buildProgressResponse(session.progress));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
