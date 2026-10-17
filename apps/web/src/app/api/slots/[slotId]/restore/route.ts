import { restoreVersion } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
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
    const message = err instanceof Error ? err.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
