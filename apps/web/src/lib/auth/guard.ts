import { NextResponse } from "next/server";
import {
  sessionCookieName,
  verifySessionToken,
  type SessionPayload,
} from "./session";

/** Read the session cookie. Returns a 401 response when it is missing or bad. */
export async function requireSession(
  request: Request
): Promise<SessionPayload | NextResponse> {
  const header = request.headers.get("cookie") ?? "";
  const name = sessionCookieName();
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  const session = await verifySessionToken(raw);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
