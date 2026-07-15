import { createHmac, timingSafeEqual } from "node:crypto";

import { getAuthUserConfig, getSessionSecret, isAuthEnabled, type AuthUserConfig, type AuthUsername } from "@/lib/auth/config";

/**
 * Reine Cookie-/Signatur-Logik ohne next/headers-Abhaengigkeit. WICHTIG: diese
 * Datei darf NICHT `next/headers` importieren - sie wird auch vom
 * socket.io-Handshake in lib/socket/server.ts genutzt, der ueber server.ts
 * (custom Node server) VOR der Next.js-App-Initialisierung geladen wird.
 * Ein next/headers-Import an dieser Stelle wirft zur Modul-Ladezeit
 * "Invariant: AsyncLocalStorage accessed in runtime where it is not available",
 * weil Next.js' interner AsyncLocalStorage-Kontext dann noch nicht bereitsteht.
 */

export const SESSION_COOKIE_NAME = "oly_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

type SessionPayload = {
  username: AuthUsername;
  iat: number;
  exp: number;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payloadBase64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

/**
 * Baut den Cookie-Wert "payload.signature". Gibt null zurueck, wenn kein Secret
 * verfuegbar ist (z. B. Produktion ohne OLY_AUTH_SECRET) - fail closed.
 */
export function createSessionCookieValue(username: AuthUsername): string | null {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const now = Date.now();
  const payload: SessionPayload = { username, iat: now, exp: now + SESSION_TTL_MS };
  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

/**
 * Prueft eine Session (Signatur + Ablauf) und gibt den Benutzer zurueck, oder null.
 */
export function verifySession(cookieValue: string | null | undefined): AuthUserConfig | null {
  if (!cookieValue) {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const payloadBase64 = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expectedSignature = sign(payloadBase64, secret);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadBase64)) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return null;
  }

  return getAuthUserConfig(payload.username);
}

/**
 * Extrahiert den oly_session-Cookiewert aus einem rohen "Cookie:"-Header-String.
 * Wird fuer den socket.io-Handshake gebraucht, der ausserhalb von Next.js'
 * Request-Kontext laeuft (next/headers `cookies()` ist dort nicht nutzbar).
 */
export function extractSessionCookieFromHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = part.slice(0, separatorIndex).trim();
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }

  return null;
}

/**
 * Wie getSessionUser() in lib/auth/session.ts, aber fuer Kontexte ohne
 * next/headers (z. B. den socket.io-Handshake). Gibt bei deaktiviertem Login
 * (isAuthEnabled() === false) immer null zurueck, damit sich der Auth-OFF-Pfad
 * nicht aendert.
 */
export function getSessionUserFromCookieHeader(cookieHeader: string | null | undefined): AuthUserConfig | null {
  if (!isAuthEnabled()) {
    return null;
  }

  return verifySession(extractSessionCookieFromHeader(cookieHeader));
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
