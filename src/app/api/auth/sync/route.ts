import { NextResponse } from "next/server";

import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { mergeProgress } from "@/lib/merge-progress";
import { readCookieSession, writeCookieSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
}
