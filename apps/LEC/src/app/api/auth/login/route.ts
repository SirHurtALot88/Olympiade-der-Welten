import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { COOKIE_NAME, createSessionToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const auth = getAuthConfig();

  if (!auth.enabled || auth.misconfigured) {
    return NextResponse.json({ error: "auth_misconfigured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password.length === 0 || password !== auth.password) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  // Langlebige Session (365 Tage): einmal pro Geraet einloggen, danach
  // dauerhaft angemeldet bleiben -- kein "Angemeldet bleiben"-Haekchen noetig.
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const token = await createSessionToken(auth.secret!, ONE_YEAR_SECONDS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
}
