import { requireSession } from "@/lib/auth/guard";
import { publicError } from "@/lib/public-error";
import { MAX_UPLOAD_BYTES, previewUpload } from "@/lib/vault";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  const announced = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(announced) && announced > MAX_UPLOAD_BYTES + 256 * 1024) {
    return NextResponse.json({ error: "That file is too large." }, { status: 413 });
  }
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
    return NextResponse.json(
      { error: publicError(err, "Preview failed") },
      { status: 400 }
    );
  }
}
