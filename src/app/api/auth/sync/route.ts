import { NextResponse } from "next/server";

import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { mergeProgress } from "@/lib/merge-progress";
import type { ProgressState } from "@/lib/progress";
import { readCookieSession, writeCookieSession } from "@/lib/session";
import { createClientWithTokens } from "@/lib/supabase/authed-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Tracks the last successful step so failures pinpoint where the pipeline
  // broke (auth source, cloud fetch, cloud save, cookie write) instead of a
  // generic "sync failed". Surfaced in the response and server logs.
  let step = "start";
  let authSource: "cookie" | "token" | "none" = "none";

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
    step = "auth:cookie";
    let supabase = await createClient();
    let { data: { user }, error: userError } = await supabase.auth.getUser();
    if (user && !userError) authSource = "cookie";

    if ((userError || !user) && tokens) {
      step = "auth:token";
      supabase = await createClientWithTokens(tokens);
      ({ data: { user }, error: userError } = await supabase.auth.getUser());
      if (user && !userError) authSource = "token";
    }

    if (userError || !user) {
      console.error("[sync] auth failed", {
        step,
        hadTokens: Boolean(tokens),
        error: userError?.message,
      });
      return NextResponse.json(
        { error: userError?.message || "Unauthorized", step },
        { status: 401 },
      );
    }

    step = "readCookie";
    const cookieSession = await readCookieSession();

    // fetchCloudProgress returns null only when NO row exists yet (new user).
    // It throws when a row exists but the payload can't be parsed — in that
    // case we must not overwrite cloud, so let the error propagate to the
    // outer catch and return a 500 rather than silently wiping the user's data.
    step = "fetchCloud";
    const cloudProgress = await fetchCloudProgress(supabase, user.id);

    let merged: ProgressState;
    if (cloudProgress) {
      merged = mergeProgress(cookieSession.progress, cloudProgress);
    } else {
      // New user — no cloud row yet; use whatever progress the cookie holds.
      merged = cookieSession.progress;
    }

    step = "saveCloud";
    await saveCloudProgress(supabase, user.id, merged);

    step = "writeCookie";
    await writeCookieSession({
      ...cookieSession,
      progress: merged,
    });

    console.log("[sync] ok", {
      authSource,
      userId: user.id,
      hadCloudRow: Boolean(cloudProgress),
      totalAnswers: merged.totalAnswers,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync progress";
    // Surface PostgREST/RLS error codes when present so the failing step is
    // unambiguous in logs (e.g. 42501 = row-level security violation).
    const code =
      typeof error === "object" && error != null && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    console.error("[sync] failed", { step, authSource, code, message });
    return NextResponse.json({ error: message, step, code }, { status: 500 });
  }
}
