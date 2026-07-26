import { cookies } from "next/headers";

import { isAuthEnabled } from "@/lib/auth/config";
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

/**
 * Owner-ID der eingeloggten Session (nur wenn OLY_AUTH_ENABLED=1). Bei deaktiviertem Login ->
 * null, damit der globale Aktiv-Save-Pfad (Auth-OFF / Solo) exakt unveraendert bleibt.
 *
 * Zentrale, geteilte Implementierung (Audit S5): jeder Read-Pfad, der "meinen aktiven Save"
 * ohne explizite saveId aufloesen will, soll DIESE Funktion nutzen statt eine eigene Kopie zu
 * pflegen — nur so bleibt garantiert, dass Chris und Franky nie versehentlich denselben globalen
 * Save-Zeiger sehen.
 */
export async function resolveSessionOwnerId(): Promise<string | null> {
  if (!isAuthEnabled()) {
    return null;
  }
  return (await getSessionUser())?.ownerId ?? null;
}
