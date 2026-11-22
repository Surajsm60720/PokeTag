import { requireSession } from "@/lib/auth/guard";
import { publicError } from "@/lib/public-error";
import { restoreVersion } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { slotId } = await context.params;
    const body = (await request.json()) as { versionId?: string };
    if (!body.versionId) {
      return NextResponse.json({ error: "versionId required" }, { status: 400 });
    }
    const result = await restoreVersion(slotId, body.versionId);
    return NextResponse.json({
      ...result,
      message: "Your save is fully restored. We hope to see you again!",
    });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err, "Restore failed") },
      { status: 400 }
    );
  }
}
