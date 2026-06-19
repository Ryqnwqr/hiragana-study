import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compressProgress,
  expandProgress,
  isCompactProgress,
} from "@/lib/compact-session";
import type { ProgressState } from "@/lib/progress";

/**
 * Returns the user's cloud progress, or null when no row exists yet (new user).
 * Throws if the row exists but the payload cannot be parsed — callers must not
 * overwrite cloud data in that case (it could be a format we don't understand).
 */
export async function fetchCloudProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProgressState | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null; // No row — genuinely new user

  if (!isCompactProgress(data.payload)) {
    // Row exists but format is unrecognized — do NOT silently return null,
    // which would cause callers to overwrite it with potentially empty data.
    throw new Error("Cloud progress row exists but payload format is unrecognized");
  }

  return expandProgress(data.payload);
}

export async function saveCloudProgress(
  supabase: SupabaseClient,
  userId: string,
  progress: ProgressState,
): Promise<void> {
  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: userId,
      payload: compressProgress(progress),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
