import { NextResponse } from "next/server";

import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { mergeProgress } from "@/lib/merge-progress";
import type { ProgressState } from "@/lib/progress";
import { readCookieSession, writeCookieSession } from "@/lib/session";
import { createClientWithTokens } from "@/lib/supabase/authed-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const tokens =
      typeof body.access_token === "string" && typeof body.refresh_token === "string"
        ? { access_token: body.access_token, refresh_token: body.refresh_token }
        : null;

    // Try cookie-based auth first (fastest, no extra network call).
    // Fall back to token-based auth if the cookies don't have a valid session
    // — this covers the edge case where the sign-in just happened and the
    // Supabase auth cookies haven't propagated to the server context yet.
    let supabase = await createClient();
    let { data: { user }, error: userError } = await supabase.auth.getUser();

    if ((userError || !user) && tokens) {
      supabase = await createClientWithTokens(tokens);
      ({ data: { user }, error: userError } = await supabase.auth.getUser());
    }

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message || "Unauthorized" },
        { status: 401 },
      );
    }

    const cookieSession = await readCookieSession();

    // fetchCloudProgress returns null only when NO row exists yet (new user).
    // It throws when a row exists but the payload can't be parsed — in that
    // case we must not overwrite cloud, so let the error propagate to the
    // outer catch and return a 500 rather than silently wiping the user's data.
    const cloudProgress = await fetchCloudProgress(supabase, user.id);

    let merged: ProgressState;
    if (cloudProgress) {
      merged = mergeProgress(cookieSession.progress, cloudProgress);
    } else {
      // New user — no cloud row yet; use whatever progress the cookie holds.
      merged = cookieSession.progress;
    }

    await saveCloudProgress(supabase, user.id, merged);
    await writeCookieSession({
      ...cookieSession,
      progress: merged,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
