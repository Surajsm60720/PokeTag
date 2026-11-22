import { convertSave, suggestedFilename, type ConvertTarget } from "@poketag/save-format";
import { createHash } from "crypto";
import { requireSession } from "@/lib/auth/guard";
import { loadVersionBytes } from "@/lib/vault";
import { getDb } from "@/lib/db";
import { publicError } from "@/lib/public-error";
import { NextResponse } from "next/server";

function safeFilename(name: string): string {
  const cleaned = name.replace(/[\r\n"\\]/g, "").slice(0, 120).trim();
  return cleaned || "save.sav";
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("versionId");
    if (!versionId) {
      return NextResponse.json({ error: "versionId required" }, { status: 400 });
    }

    const mode = (searchParams.get("format") || "original") as
      | "original"
      | ConvertTarget;
    const romName = searchParams.get("romName") || "";
    const deviceLabel = searchParams.get("deviceLabel") || "";

    const { data, version } = await loadVersionBytes(versionId);

    let out = data;
    let filename = version.original_filename;

    if (mode !== "original") {
      const converted = convertSave(data, mode, version.original_filename);
      out = converted.data;
      filename = romName
        ? suggestedFilename(romName, mode)
        : converted.filename;
    } else if (romName) {
      const ext =
        version.original_filename.split(".").pop()?.toLowerCase() || "sav";
      filename = suggestedFilename(romName, ext as ConvertTarget);
    }

    if (deviceLabel) {
      const db = await getDb();
      await db
        .prepare(
          `INSERT INTO device_state (device_label, slot_id, last_downloaded_version_id)
           VALUES (?, ?, ?)
           ON CONFLICT(device_label, slot_id) DO UPDATE SET
             last_downloaded_version_id = excluded.last_downloaded_version_id`
        )
        .run(deviceLabel, version.slot_id, versionId);
    }

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
        "Content-Length": String(out.length),
        "X-Poketag-Sha256": createHash("sha256").update(out).digest("hex"),
      },
    });
  } catch (err) {
    console.error("download failed");
    return NextResponse.json(
      { error: publicError(err, "Download failed") },
      { status: 404 }
    );
  }
}
