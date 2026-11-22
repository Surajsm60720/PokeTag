import { requireSession } from "@/lib/auth/guard";
import { publicError } from "@/lib/public-error";
import { listSlots } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const slots = await listSlots();
    return NextResponse.json({ slots });
  } catch (err) {
    console.error("list slots failed");
    return NextResponse.json(
      { error: publicError(err, "Failed to list slots") },
      { status: 500 }
    );
  }
}
