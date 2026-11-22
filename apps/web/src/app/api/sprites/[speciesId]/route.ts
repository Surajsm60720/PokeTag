import { requireSession } from "@/lib/auth/guard";
import { pokeApiSpriteUrl } from "@/lib/creature-art";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Same-origin sprite. The browser never talks to GitHub directly.
 * Only a logged-in session can ask, and only for a species number.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ speciesId: string }> }
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;

  const { speciesId } = await context.params;
  const id = Number(speciesId);
  if (!Number.isInteger(id) || id < 1 || id > 1025) {
    return NextResponse.json({ error: "Unknown species." }, { status: 400 });
  }

  const url = new URL(request.url);
  const shiny = url.searchParams.get("shiny") === "1";
  const variant = url.searchParams.get("variant") === "art" ? "art" : "pixel";
  const upstream = pokeApiSpriteUrl(id, shiny, variant);
  if (!upstream) {
    return NextResponse.json({ error: "Unknown species." }, { status: 400 });
  }

  try {
    const res = await fetch(upstream);
    if (!res.ok) {
      return NextResponse.json({ error: "Sprite unavailable." }, { status: 404 });
    }
    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/png",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sprite unavailable." }, { status: 404 });
  }
}
