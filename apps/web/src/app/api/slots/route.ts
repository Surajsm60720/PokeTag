import { listSlots } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const slots = listSlots();
    return NextResponse.json({ slots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list slots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
