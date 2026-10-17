import { PATH_HINTS } from "@/lib/path-hints";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ hints: PATH_HINTS });
}
