import { NextResponse } from "next/server";

import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { mergeProgress } from "@/lib/merge-progress";
import { readCookieSession, writeCookieSession } from "@/lib/session";
import {
  createClientWithTokens,
  type AuthTokens,
} from "@/lib/supabase/authed-server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<AuthTokens>;
    const tokens =
      body.access_token && body.refresh_token
        ? {
            access_token: body.access_token,
            refresh_token: body.refresh_token,
          }
        : null;

    const supabase = await createClientWithTokens(tokens);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message || "Unauthorized" },
        { status: 401 },
      );
    }

    const cookieSession = await readCookieSession();
    const cloudProgress = await fetchCloudProgress(supabase, user.id);
    const merged = cloudProgress
      ? mergeProgress(cookieSession.progress, cloudProgress)
      : cookieSession.progress;

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
