import { previewUpload } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    const slotId = String(form.get("slotId") || "") || undefined;
    const runLabel = String(form.get("runLabel") || "") || undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await previewUpload(buffer, file.name, slotId, runLabel);
    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
