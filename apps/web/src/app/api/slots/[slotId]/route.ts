import { requireSession } from "@/lib/auth/guard";
import { ensureParsed } from "@/lib/parse-job";
import { publicError } from "@/lib/public-error";
import {
  deleteSlot,
  getSlot,
  getSlotSnapshot,
  listVersions,
} from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { slotId } = await context.params;
    let slot = await getSlot(slotId);
    if (!slot) {
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }

    // Slot detail polls while parse is pending/running. On Vercel the upload
    // fire-and-forget often freezes mid-job — finish it on the poll request.
    if (
      slot.currentVersionId &&
      (slot.parseStatus === "pending" || slot.parseStatus === "running")
    ) {
      await ensureParsed(slot.currentVersionId);
      slot = (await getSlot(slotId)) ?? slot;
    }

    const snapshot = await getSlotSnapshot(slotId);
    const versions = (await listVersions(slotId)).map((v) => ({
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
      parseStatus: v.parse_status,
      parseError: v.parse_error,
      parsedAt: v.parsed_at,
      isCurrent: v.id === slot.currentVersionId,
    }));
    return NextResponse.json({
      slot,
      versions,
      snapshot,
      parseStatus: slot.parseStatus,
      parseError: slot.parseError,
    });
  } catch (err) {
    console.error("load slot failed");
    return NextResponse.json(
      { error: publicError(err, "Failed to load slot") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ slotId: string }> }
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { slotId } = await context.params;
    await deleteSlot(slotId);
    return NextResponse.json({ ok: true, message: "Run deleted." });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err, "Delete failed") },
      { status: 400 }
    );
  }
}
