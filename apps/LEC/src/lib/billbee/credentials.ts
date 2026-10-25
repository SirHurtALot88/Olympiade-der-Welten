import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { billbeeConfigFromEnv, BILLBEE_BASE_URL, type BillbeeConfig } from "./client";

/**
 * Billbee-Zugangsdaten, die Chris in den Einstellungen eingibt. Sie liegen verschluesselt in der
 * Datenbank (AES-256-GCM, Schluessel aus LEC_AUTH_SECRET) und werden nie angezeigt oder ausgeliefert.
 * Umgebungsvariablen (BILLBEE_*) haben Vorrang, falls gesetzt.
 */

const KEY = "billbee";

export interface BillbeeCredentials {
  user: string;
  password: string;
  apiKey: string;
}

function keyFrom(secret: string): Buffer {
  return scryptSync(secret, "lec-integration-secret", 32);
}

export function encryptJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Null bei falschem Schluessel oder beschaedigten Daten. */
export function decryptJson<T>(blob: string, secret: string): T | null {
  try {
    const [v, iv, tag, data] = blob.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export class MissingSecretError extends Error {
  constructor() {
    super("LEC_AUTH_SECRET fehlt: ohne ihn lassen sich Zugangsdaten nicht verschluesselt speichern.");
  }
}

export async function saveBillbeeCredentials(
  prisma: PrismaClient,
  creds: BillbeeCredentials,
  secret: string | undefined = process.env.LEC_AUTH_SECRET
): Promise<void> {
  if (!secret) throw new MissingSecretError();
  const value = encryptJson(creds, secret);
  await prisma.integrationSecret.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

export async function deleteBillbeeCredentials(prisma: PrismaClient): Promise<void> {
  await prisma.integrationSecret.deleteMany({ where: { key: KEY } });
}

export type ConfigSource = "env" | "app" | null;

/** Umgebung zuerst, sonst die in der App gespeicherten Werte. */
export async function loadBillbeeConfig(
  prisma: PrismaClient,
  env: Record<string, string | undefined> = process.env
): Promise<{ config: BillbeeConfig | null; source: ConfigSource }> {
  const fromEnv = billbeeConfigFromEnv(env);
  if (fromEnv) return { config: fromEnv, source: "env" };
  const secret = env.LEC_AUTH_SECRET;
  if (!secret) return { config: null, source: null };
  const row = await prisma.integrationSecret.findUnique({ where: { key: KEY } });
  if (!row) return { config: null, source: null };
  const c = decryptJson<BillbeeCredentials>(row.value, secret);
  if (!c?.user || !c.password || !c.apiKey) return { config: null, source: null };
  return { config: { apiKey: c.apiKey, user: c.user, password: c.password, baseUrl: env.BILLBEE_BASE_URL?.trim() || BILLBEE_BASE_URL }, source: "app" };
}
