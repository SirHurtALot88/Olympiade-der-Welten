import { timingSafeEqual } from "node:crypto";

import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";

/**
 * Phase-1-Login: zwei feste Benutzer (Chris und Franky). Kein Benutzerregister,
 * keine Registrierung - nur die zwei Personen, die dieses Spiel gemeinsam spielen.
 *
 * WICHTIG: Solange OLY_AUTH_ENABLED nicht gesetzt ist, greift keiner dieser Werte -
 * die App verhaelt sich exakt wie vorher (siehe isAuthEnabled()).
 */
export type AuthUsername = "chris" | "franky";

export type AuthUserConfig = {
  username: AuthUsername;
  /** Anzeigename fuer die deutsche UI. */
  displayName: string;
  /** Stabile Owner-ID fuer das Team-Control-System (siehe lib/foundation/team-control-settings.ts). */
  ownerId: string;
};

export const AUTH_USERS: Record<AuthUsername, AuthUserConfig> = {
  chris: {
    username: "chris",
    displayName: "Chris",
    ownerId: DEFAULT_ACTIVE_OWNER_ID,
  },
  franky: {
    username: "franky",
    displayName: "Franky",
    ownerId: FRANKY_OWNER_ID,
  },
};

function isKnownUsername(value: string): value is AuthUsername {
  return value === "chris" || value === "franky";
}

export function getAuthUserConfig(username: string | null | undefined): AuthUserConfig | null {
  if (!username) {
    return null;
  }
  const normalized = username.trim().toLowerCase();
  return isKnownUsername(normalized) ? AUTH_USERS[normalized] : null;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * Phase-1-Login ist standardmaessig AUS. Nur wenn OLY_AUTH_ENABLED="1" gesetzt ist,
 * wird die Login-Pflicht, die Route-Absicherung und die Identitaets-Verdrahtung aktiv.
 * Bei jedem anderen Wert (oder fehlender Variable) bleibt die App exakt wie vorher.
 */
export function isAuthEnabled(): boolean {
  return process.env.OLY_AUTH_ENABLED === "1";
}

const DEV_FALLBACK_PASSWORDS: Record<AuthUsername, string> = {
  chris: "chris",
  franky: "franky",
};

const DEV_FALLBACK_SESSION_SECRET = "oly-dev-only-session-secret-do-not-use-in-production";

function getConfiguredPassword(username: AuthUsername): string | null {
  const envVarName = username === "chris" ? "OLY_USER_CHRIS_PASSWORD" : "OLY_USER_FRANKY_PASSWORD";
  const configured = process.env[envVarName];
  if (configured && configured.length > 0) {
    return configured;
  }

  if (!isProduction()) {
    return DEV_FALLBACK_PASSWORDS[username];
  }

  // Fail closed: in production, without a configured password there is no login.
  return null;
}

/**
 * Liefert das Session-Secret. In Produktion ist OLY_AUTH_SECRET zwingend gesetzt -
 * fehlt es, schlaegt jede Session-Erstellung/-Pruefung fehl (fail closed), statt
 * ein Default-Secret zu verwenden.
 */
export function getSessionSecret(): string | null {
  const configured = process.env.OLY_AUTH_SECRET;
  if (configured && configured.length > 0) {
    return configured;
  }

  if (!isProduction()) {
    return DEV_FALLBACK_SESSION_SECRET;
  }

  return null;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    // Still run a comparison of equal-length buffers so failure timing does not
    // trivially leak the expected password length.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Prueft Benutzername + Passwort gegen die konfigurierten Werte. Nutzt einen
 * zeitkonstanten Vergleich, damit die Antwortzeit das Passwort nicht verraet.
 * Gibt bei fehlender Konfiguration in Produktion immer false zurueck (fail closed).
 */
export function verifyCredentials(username: string, password: string): AuthUserConfig | null {
  const user = getAuthUserConfig(username);
  if (!user) {
    return null;
  }

  const expectedPassword = getConfiguredPassword(user.username);
  if (!expectedPassword) {
    return null;
  }

  return constantTimeStringEqual(password ?? "", expectedPassword) ? user : null;
}
