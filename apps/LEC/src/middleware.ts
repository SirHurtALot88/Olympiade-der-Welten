import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "./lib/auth/config";
import { COOKIE_NAME, verifySessionToken } from "./lib/auth/session";

/**
 * Zugangsschutz fuer die gesamte App (Seiten + API), siehe
 * src/lib/auth/config.ts fuer die Ein/Aus-Regeln. Zusaetzlich wird auf jede
 * Antwort ein "X-Robots-Tag: noindex, nofollow" gesetzt, damit die (nicht
 * gelistete) Subdomain nicht versehentlich indexiert wird.
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const auth = getAuthConfig();

  if (!auth.enabled) {
    return withRobotsHeader(NextResponse.next());
  }

  if (auth.misconfigured) {
    // Fail closed: ohne Passwort/Secret in Produktion NIE durchlassen.
    const message = "LEC Cockpit ist falsch konfiguriert (LEC_PASSWORD/LEC_AUTH_SECRET fehlen).";
    if (pathname.startsWith("/api")) {
      return withRobotsHeader(
        NextResponse.json({ error: "auth_misconfigured", message }, { status: 503 })
      );
    }
    return withRobotsHeader(new NextResponse(message, { status: 503 }));
  }

  if (isPublicPath(pathname)) {
    return withRobotsHeader(NextResponse.next());
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = token ? await verifySessionToken(token, auth.secret!) : false;

  if (!valid) {
    if (pathname.startsWith("/api")) {
      return withRobotsHeader(NextResponse.json({ error: "unauthenticated" }, { status: 401 }));
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return withRobotsHeader(NextResponse.redirect(loginUrl));
  }

  return withRobotsHeader(NextResponse.next());
}

function withRobotsHeader(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
