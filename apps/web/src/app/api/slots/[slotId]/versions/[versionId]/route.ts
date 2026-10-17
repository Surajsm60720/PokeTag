import { deleteVersion } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slotId: string; versionId: string }> }
) {
  try {
    const { slotId, versionId } = await context.params;
    await deleteVersion(slotId, versionId);
    return NextResponse.json({ ok: true, message: "Version deleted." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
