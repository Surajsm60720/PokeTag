import { SlotDetail } from "@/components/SlotDetail";
import { themeBootstrapScript } from "@/lib/theme";
import { readSlotPage } from "@/lib/shelf-read";
import type { DetectionResult } from "@poketag/save-format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const loaded = await readSlotPage(slotId);
  if (!loaded) notFound();

  const { slot, snapshot } = loaded;
  const versionRows = loaded.versions;

  const versions = versionRows.map((v) => {
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
      <script
        dangerouslySetInnerHTML={{
          __html: themeBootstrapScript(slot.gameVersion),
        }}
      />
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
          parseStatus: slot.parseStatus,
          parseError: slot.parseError,
        }}
        versions={versions}
        snapshot={snapshot}
      />
    </main>
  );
}
