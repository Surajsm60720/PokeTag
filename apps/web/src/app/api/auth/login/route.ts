import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPasswordHash,
  getAuthUsername,
  isAuthConfigured,
} from "@/lib/auth/config";
import { safeEqualString, verifyPassword } from "@/lib/auth/password";
import { clientAddress } from "@/lib/auth/client-ip";
import {
  clearLoginFailures,
  loginAllowed,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import {
  buildSessionCookie,
  createSessionToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured on this server." },
      { status: 503 }
    );
  }

  const ip = clientAddress(req.headers);
  const gate = await loginAllowed(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(gate.retryAfter) },
      }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length > 64 || password.length > 200) {
    await recordLoginFailure(ip);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required." },
      { status: 400 }
    );
  }

  const expectedUser = getAuthUsername();
  const userOk = safeEqualString(username, expectedUser);
  const passOk = await verifyPassword(password, getAuthPasswordHash());

  if (!userOk || !passOk) {
    await recordLoginFailure(ip);
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  await clearLoginFailures(ip);
  const { token, maxAge } = await createSessionToken(expectedUser);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", buildSessionCookie(token, maxAge));
  return res;
}
