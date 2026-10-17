import { commitUpload } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await commitUpload({
      data: buffer,
      filename: file.name,
      runLabel: String(form.get("runLabel") || ""),
      slotId: String(form.get("slotId") || "") || undefined,
      sourceEmulator: String(form.get("sourceEmulator") || ""),
      sourceDevice: String(form.get("sourceDevice") || ""),
      note: String(form.get("note") || ""),
    });

    if (result.duplicate) {
      return NextResponse.json(
        {
          duplicate: true,
          slotId: result.slotId,
          versionId: result.versionId,
          message:
            "This save is already in the vault. Same data, same trainer.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      duplicate: false,
      slotId: result.slotId,
      versionId: result.versionId,
      message: "A new save was caught!",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
