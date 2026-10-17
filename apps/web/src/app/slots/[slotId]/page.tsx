import { SlotDetail } from "@/components/SlotDetail";
import { getSlot, listVersions } from "@/lib/vault";
import type { DetectionResult } from "@poketag/save-format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function parseDetection(json: string): Partial<DetectionResult> {
  try {
    return JSON.parse(json || "{}") as DetectionResult;
  } catch {
    return {};
  }
}

export default async function SlotPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  const slot = getSlot(slotId);
  if (!slot) notFound();

  const versions = listVersions(slotId).map((v) => {
    const detection = parseDetection(v.detection_json);
    return {
      id: v.id,
      uploadedAt: v.uploaded_at,
      originalFilename: v.original_filename,
      sourceFormat: v.source_format,
      sourceDevice: v.source_device,
      sourceEmulator: v.source_emulator,
      sha256: v.sha256,
      sizeBytes: v.size_bytes,
      note: v.note,
      isCurrent: v.id === slot.currentVersionId,
      recognized: Boolean(v.recognized),
      detectionLabel: detection.label || slot.label,
      detectionNotes: detection.notes || [],
      hasDesmumeFooter: Boolean(detection.hasDesmumeFooter),
      rawPayloadSize: detection.rawPayloadSize ?? null,
    };
  });

  return (
    <main>
      <SlotDetail
        slot={{
          id: slot.id,
          runLabel: slot.runLabel,
          label: slot.label,
          gameVersion: slot.gameVersion,
          generation: slot.generation,
          createdAt: slot.createdAt,
          recognized: slot.recognized,
          currentVersionId: slot.currentVersionId,
        }}
        versions={versions}
      />
    </main>
  );
}
