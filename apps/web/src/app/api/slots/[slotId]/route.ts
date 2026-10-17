import { getSlot, listVersions } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  try {
    const { slotId } = await context.params;
    const slot = getSlot(slotId);
    if (!slot) {
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }
    const versions = listVersions(slotId).map((v) => ({
      id: v.id,
      slotId: v.slot_id,
      parentVersionId: v.parent_version_id,
      sha256: v.sha256,
      sizeBytes: v.size_bytes,
      originalFilename: v.original_filename,
      sourceFormat: v.source_format,
      sourceEmulator: v.source_emulator,
      sourceDevice: v.source_device,
      uploadedAt: v.uploaded_at,
      note: v.note,
      recognized: Boolean(v.recognized),
      detection: JSON.parse(v.detection_json || "{}"),
      isCurrent: v.id === slot.currentVersionId,
    }));
    return NextResponse.json({ slot, versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load slot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
