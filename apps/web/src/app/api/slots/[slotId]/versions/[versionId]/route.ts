import { requireSession } from "@/lib/auth/guard";
import { publicError } from "@/lib/public-error";
import { deleteVersion } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slotId: string; versionId: string }> }
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { slotId, versionId } = await context.params;
    await deleteVersion(slotId, versionId);
    return NextResponse.json({ ok: true, message: "Version deleted." });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err, "Delete failed") },
      { status: 400 }
    );
  }
}
