import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  compressSession,
  expandLegacyOrCompact,
} from "@/lib/compact-session";
import { fetchCloudProgress, saveCloudProgress } from "@/lib/cloud-progress";
import {
  createDefaultProgress,
  createDefaultSession,
  type AppSession,
  type ProgressState,
} from "@/lib/progress";
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

const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24;
const SIGNED_IN_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function clearCookieSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function writeCookieSession(
  session: AppSession,
  options?: { guest?: boolean },
): Promise<void> {
  const cookieStore = await cookies();
  const guest = options?.guest ?? false;
  const maxAge = guest ? GUEST_COOKIE_MAX_AGE : SIGNED_IN_COOKIE_MAX_AGE;
  const token = await new SignJWT(compressSession(session))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

async function persistCloudProgress(
  userId: string,
  progress: ProgressState,
): Promise<void> {
  const supabase = await createClient();
  await saveCloudProgress(supabase, userId, progress);
}

function scheduleCloudPersist(userId: string, progress: ProgressState) {
  void persistCloudProgress(userId, progress).catch(() => {
    // Cookie already has the latest state; cloud sync can retry on the next write.
  });
}

/** Fast path for gameplay — cookie only, no cloud round-trip. */
export async function readPlaySession(): Promise<AppSession> {
  return readCookieSession();
}

/**
 * Fast path for gameplay — writes cookie immediately, cloud sync in background.
 */
export async function writePlaySession(
  session: AppSession,
  options?: { awaitCloud?: boolean },
): Promise<void> {
  const userId = await getAuthUserId();

  if (!userId) {
    await writeCookieSession(session, { guest: true });
    return;
  }

  await writeCookieSession(session);

  if (options?.awaitCloud) {
    await persistCloudProgress(userId, session.progress);
    return;
  }

  scheduleCloudPersist(userId, session.progress);
}

/** Full read — merges cloud progress when signed in (for sync / initial load). */
export async function readSession(): Promise<AppSession> {
  const [cookieSession, userId] = await Promise.all([
    readCookieSession(),
    getAuthUserId(),
  ]);

  if (!userId) return cookieSession;

  try {
    const supabase = await createClient();
    const cloudProgress = await fetchCloudProgress(supabase, userId);
    if (cloudProgress) {
      return {
        progress: cloudProgress,
        round: cookieSession.round,
      };
    }
  } catch {
    // Fall back to cookie progress if cloud read fails.
  }

  return cookieSession;
}

export async function writeSession(session: AppSession): Promise<void> {
  await writePlaySession(session, { awaitCloud: true });
}

/** Wipe progress in the cookie and cloud (best effort). */
export async function resetAllProgress(): Promise<AppSession> {
  const session: AppSession = {
    progress: createDefaultProgress(),
    round: null,
  };
  const userId = await getAuthUserId();

  if (!userId) {
    await writeCookieSession(session, { guest: true });
    return session;
  }

  await writeCookieSession(session);
  try {
    await persistCloudProgress(userId, session.progress);
  } catch {
    // Cookie is already reset; cloud can catch up on the next signed-in write.
  }

  return session;
}
