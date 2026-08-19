import { cookies } from "next/headers";

import { isAuthEnabled } from "@/lib/auth/config";
import type { AuthUserConfig, AuthUsername } from "@/lib/auth/config";
import { createSessionCookieValue, SESSION_COOKIE_NAME, sessionCookieOptions, verifySession } from "@/lib/auth/session-cookie";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";

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

/**
 * DIE EINE STELLE, an der ein `authorizeServerRoomWrite`-Aufrufer AUSSERHALB eines Raums die
 * Schreib-Identitaet bestimmt (Stufe 0.3, docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B2).
 * Rangfolge: angemeldete Sitzung, sonst der lokale Standard-Owner (heutiger Solo-Betrieb,
 * unveraendert). Nimmt ABSICHTLICH keinen Parameter aus Body/Query entgegen — genau das war das
 * Loch: `authorizeLocalSingleplayerTeamWrite` vertraute bislang direkt einem Client-Feld namens
 * `activeOwnerId`, das aber die Owner-ID des ZIELTEAMS trug, nicht die eigene
 * (use-foundation-shell-router-body-scope.tsx:1352-1368) — der Besitzvergleich war damit fuer jedes
 * `manual`-Team immer wahr.
 *
 * NUR fuer den Nicht-Raum-Fall: IM Raum ist das Sitz-Token bereits der Ausweis
 * (`findSeatByToken`/`authorizeTeamWrite` in server-authoritative-write-guard.ts bzw.
 * online-room-model.ts) — dafuer wird diese Funktion nicht gebraucht und nicht aufgerufen.
 *
 * Lebt hier und nicht in server-authoritative-write-guard.ts, weil dieses Modul `next/headers`
 * braucht (ueber `resolveSessionOwnerId`/`getSessionUser`) — der Guard wird auch vom
 * socket.io-Server geladen, der ausserhalb jedes Next.js-Request-Kontexts laeuft und an so einem
 * Import zur Modul-Ladezeit abstuerzen wuerde (siehe Kommentar an lib/auth/session-cookie.ts).
 * Aufrufer (Next.js-Route-Handler) importieren diese Funktion selbst und reichen das Ergebnis als
 * `activeOwnerId` in den Guard-Kontext hinein.
 */
export async function resolveAuthoritativeWriteOwnerId(): Promise<string> {
  return (await resolveSessionOwnerId()) ?? DEFAULT_ACTIVE_OWNER_ID;
}
