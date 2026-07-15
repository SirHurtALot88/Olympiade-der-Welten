export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { isAuthEnabled, verifyCredentials } from "@/lib/auth/config";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  // Phase-1-Login ist standardmaessig AUS: solange OLY_AUTH_ENABLED nicht "1"
  // ist, gibt es keinen Login, auch nicht bei korrekten (Dev-Fallback-)
  // Zugangsdaten - der Auth-OFF-Pfad bleibt so vollstaendig inert.
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: false, error: "Login ist deaktiviert." }, { status: 404 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Falscher Benutzer oder falsches Passwort." }, { status: 401 });
  }

  const sessionCreated = await createSession(user.username);
  if (!sessionCreated) {
    // Fail closed: OLY_AUTH_SECRET fehlt in Produktion.
    return NextResponse.json(
      { ok: false, error: "Login ist derzeit nicht verfuegbar (fehlende Server-Konfiguration)." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: { username: user.username, displayName: user.displayName, ownerId: user.ownerId },
  });
}
