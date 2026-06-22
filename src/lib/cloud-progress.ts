import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compressDualProgress,
  expandDualProgress,
  isCloudProgressPayload,
  isCompactProgress,
  type CloudProgressPayload,
} from "@/lib/compact-session";
import type { DualProgress } from "@/lib/progress";

/**
 * Returns the user's cloud progress, or null when no row exists yet (new user).
 * Throws if the row exists but the payload cannot be parsed.
 */
export async function fetchCloudProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<DualProgress | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const payload = data.payload;
  if (isCloudProgressPayload(payload)) {
    return expandDualProgress(payload as CloudProgressPayload);
  }

  if (isCompactProgress(payload)) {
    return expandDualProgress({ ph: payload });
  }

  throw new Error("Cloud progress row exists but payload format is unrecognized");
}

export async function saveCloudProgress(
  supabase: SupabaseClient,
  userId: string,
  progress: DualProgress,
): Promise<void> {
  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: userId,
      payload: compressDualProgress(progress),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
