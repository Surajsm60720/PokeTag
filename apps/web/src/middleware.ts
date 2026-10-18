import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/auth/config";
import {
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const token = req.cookies.get(sessionCookieName())?.value;
  const session = await verifySessionToken(token);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
