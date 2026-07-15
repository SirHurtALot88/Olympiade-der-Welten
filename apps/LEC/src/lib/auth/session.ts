/**
 * Signierte Session-Tokens fuer den Single-User-Login. Nutzt ausschliesslich
 * die Web-Crypto-API (globalThis.crypto.subtle), damit derselbe Code sowohl
 * in Next.js Middleware (Edge-Runtime) als auch in normalen Node-Route-
 * Handlern laeuft, ohne auf node:crypto angewiesen zu sein.
 *
 * Format: "<base64url(payload-json)>.<base64url(hmac-sha256-signatur)>"
 */

const COOKIE_NAME = "lec_session";
// Bewusst langlebig: "einmal pro Geraet einloggen, danach dauerhaft angemeldet
// bleiben" (Chris' Wunsch) -- kein "Angemeldet bleiben"-Haekchen noetig.
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 365; // 365 Tage

export interface SessionPayload {
  u: string; // Benutzer (fest: "chris")
  exp: number; // Unix-Timestamp (Sekunden), bis wann gueltig
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function sign(payloadB64: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionToken(
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const payload: SessionPayload = {
    u: "chris",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expectedSignature = await sign(payloadB64, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as SessionPayload;
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export { COOKIE_NAME };
