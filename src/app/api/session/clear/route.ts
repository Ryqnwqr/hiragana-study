import { NextResponse } from "next/server";

import {
  clearCookieSession,
  getAuthUserId,
} from "@/lib/session";

export async function POST() {
  const userId = await getAuthUserId();
  if (userId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await clearCookieSession();
  return NextResponse.json({ ok: true });
}
