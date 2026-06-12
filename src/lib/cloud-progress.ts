import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compressProgress,
  expandProgress,
  type CompactProgress,
} from "@/lib/compact-session";
import type { ProgressState } from "@/lib/progress";

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
  if (!data?.payload) return null;

  return expandProgress(data.payload as CompactProgress);
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
