import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  compressSession,
  expandLegacyOrCompact,
} from "@/lib/compact-session";
import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import { createDefaultSession, type AppSession } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "hira_session";

function getSecret(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-hiragana-secret");

  if (!secret) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  return new TextEncoder().encode(secret);
}

export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function readCookieSession(): Promise<AppSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return createDefaultSession();

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return expandLegacyOrCompact(payload as Record<string, unknown>);
  } catch {
    return createDefaultSession();
  }
}

export async function writeCookieSession(session: AppSession): Promise<void> {
  const cookieStore = await cookies();
  const token = await new SignJWT(compressSession(session))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(getSecret());

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function readSession(): Promise<AppSession> {
  const cookieSession = await readCookieSession();
  const userId = await getAuthUserId();
  if (!userId) return cookieSession;

  const supabase = await createClient();
  const cloudProgress = await fetchCloudProgress(supabase, userId);
  if (!cloudProgress) return cookieSession;

  return {
    progress: cloudProgress,
    round: cookieSession.round,
  };
}

export async function writeSession(session: AppSession): Promise<void> {
  await writeCookieSession(session);

  const userId = await getAuthUserId();
  if (!userId) return;

  const supabase = await createClient();
  await saveCloudProgress(supabase, userId, session.progress);
}
