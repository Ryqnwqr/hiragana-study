import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_REMEMBER_KEY = "hira_auth_remember";
const AUTH_EXPIRES_KEY = "hira_auth_expires";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function setAuthSessionPolicy(rememberMe: boolean) {
  if (typeof window === "undefined") return;

  if (rememberMe) {
    localStorage.setItem(AUTH_REMEMBER_KEY, "1");
    localStorage.removeItem(AUTH_EXPIRES_KEY);
    return;
  }

  localStorage.removeItem(AUTH_REMEMBER_KEY);
  localStorage.setItem(AUTH_EXPIRES_KEY, String(Date.now() + TWO_DAYS_MS));
}

export function clearAuthSessionPolicy() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_REMEMBER_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
}

/** Signs out when the 2-day window has passed (non-remember sessions). */
export async function enforceAuthSessionPolicy(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(AUTH_REMEMBER_KEY) === "1") return false;

  const expiresRaw = localStorage.getItem(AUTH_EXPIRES_KEY);
  if (!expiresRaw) return false;

  if (Date.now() <= Number(expiresRaw)) return false;

  clearAuthSessionPolicy();
  await supabase.auth.signOut();
  return true;
}
