import { NextResponse } from "next/server";
import { getGroupNames } from "@/lib/hiragana";

export async function GET() {
  return NextResponse.json({ groups: getGroupNames() });
}
