import { cookies } from "next/headers";

import type { AuthUserConfig, AuthUsername } from "@/lib/auth/config";
import { createSessionCookieValue, SESSION_COOKIE_NAME, sessionCookieOptions, verifySession } from "@/lib/auth/session-cookie";

/**
 * Nur fuer echte Next.js-Request-Kontexte (Server Components, Layouts, Route
 * Handlers), wo next/headers `cookies()` verfuegbar ist. Fuer den
 * socket.io-Handshake siehe lib/auth/session-cookie.ts (getSessionUserFromCookieHeader).
 */

export { SESSION_COOKIE_NAME, createSessionCookieValue, verifySession } from "@/lib/auth/session-cookie";

/**
 * Setzt den Session-Cookie fuer den aktuellen Response (nur in Route Handlers /
 * Server Actions nutzbar, wo `cookies()` schreibbar ist).
 */
export async function createSession(username: AuthUsername): Promise<boolean> {
  const value = createSessionCookieValue(username);
  if (!value) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, value, sessionCookieOptions());
  return true;
}

/**
 * Loescht den Session-Cookie.
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions(), maxAge: 0 });
}

/**
 * Liest den aktuellen Session-Benutzer aus dem Cookie (Server Components, Layouts,
 * Route Handlers). Gibt null zurueck, wenn keine gueltige Session vorliegt.
 */
export async function getSessionUser(): Promise<AuthUserConfig | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  return verifySession(raw);
}
