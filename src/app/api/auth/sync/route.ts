import { NextResponse } from "next/server";

import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { mergeDualProgress } from "@/lib/merge-progress";
import { getSessionProgress, type DualProgress } from "@/lib/progress";
import { readCookieSession, writeCookieSession } from "@/lib/session";
import { createClientWithTokens } from "@/lib/supabase/authed-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let step = "start";
  let authSource: "cookie" | "token" | "none" = "none";

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    const tokens =
      typeof body.access_token === "string" && typeof body.refresh_token === "string"
        ? { access_token: body.access_token, refresh_token: body.refresh_token }
        : null;

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

    step = "fetchCloud";
    const cloudProgress = await fetchCloudProgress(supabase, user.id);

    let merged: DualProgress;
    if (cloudProgress) {
      merged = mergeDualProgress(cookieSession.progress, cloudProgress);
    } else {
      merged = cookieSession.progress;
    }

    step = "saveCloud";
    await saveCloudProgress(supabase, user.id, merged);

    step = "writeCookie";
    await writeCookieSession({
      ...cookieSession,
      progress: merged,
    });

    const active = getSessionProgress({ ...cookieSession, progress: merged });
    console.log("[sync] ok", {
      authSource,
      userId: user.id,
      hadCloudRow: Boolean(cloudProgress),
      totalAnswers: active.totalAnswers,
      mode: cookieSession.mode,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync progress";
    const code =
      typeof error === "object" && error != null && "code" in error
        ? String((error as { code: unknown }).code)
        : undefined;
    console.error("[sync] failed", { step, authSource, code, message });
    return NextResponse.json({ error: message, step, code }, { status: 500 });
  }
}
