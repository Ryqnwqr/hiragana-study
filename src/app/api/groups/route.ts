import { NextResponse } from "next/server";

import { readPlaySession } from "@/lib/session";
import { getGroupNames } from "@/lib/syllabary";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readPlaySession();
  return NextResponse.json({
    mode: session.mode,
    groups: getGroupNames(session.mode),
  });
}
