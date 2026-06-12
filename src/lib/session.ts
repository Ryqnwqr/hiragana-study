import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  compressSession,
  expandLegacyOrCompact,
} from "@/lib/compact-session";
import { createDefaultSession, type AppSession } from "@/lib/progress";

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

export async function readSession(): Promise<AppSession> {
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

export async function writeSession(session: AppSession): Promise<void> {
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
