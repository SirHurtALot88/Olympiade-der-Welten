import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { decryptJson, deleteBillbeeCredentials, encryptJson, loadBillbeeConfig, MissingSecretError, saveBillbeeCredentials } from "./credentials";

const CREDS = { user: "chris@example.de", password: "geheim-pw", apiKey: "KEY-123" };
const SECRET = "ein-langes-app-geheimnis";

describe("Verschluesselung", () => {
  it("rundet hin und zurueck", () => {
    const blob = encryptJson(CREDS, SECRET);
    expect(blob).not.toContain("geheim-pw");
    expect(decryptJson(blob, SECRET)).toEqual(CREDS);
  });
  it("liefert null bei falschem Schluessel oder kaputten Daten", () => {
    const blob = encryptJson(CREDS, SECRET);
    expect(decryptJson(blob, "anderer")).toBeNull();
    expect(decryptJson(blob.slice(0, -4), SECRET)).toBeNull();
    expect(decryptJson("quatsch", SECRET)).toBeNull();
  });
  it("verschluesselt gleiche Werte jedes Mal anders", () => {
    expect(encryptJson(CREDS, SECRET)).not.toBe(encryptJson(CREDS, SECRET));
  });
});

describe("Speichern und Laden", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it("speichert verschluesselt und laedt wieder", async () => {
    await saveBillbeeCredentials(db.prisma, CREDS, SECRET);
    const row = await db.prisma.integrationSecret.findUnique({ where: { key: "billbee" } });
    expect(row!.value).not.toContain("KEY-123");
    const { config, source } = await loadBillbeeConfig(db.prisma, { LEC_AUTH_SECRET: SECRET });
    expect(source).toBe("app");
    expect(config).toMatchObject({ user: CREDS.user, password: CREDS.password, apiKey: CREDS.apiKey });
  });

  it("Umgebungsvariablen haben Vorrang", async () => {
    await saveBillbeeCredentials(db.prisma, CREDS, SECRET);
    const { config, source } = await loadBillbeeConfig(db.prisma, { LEC_AUTH_SECRET: SECRET, BILLBEE_API_KEY: "E", BILLBEE_USER: "u", BILLBEE_PASSWORD: "p" });
    expect(source).toBe("env");
    expect(config!.apiKey).toBe("E");
  });

  it("ist nicht verbunden ohne Eintrag oder mit falschem Schluessel", async () => {
    expect((await loadBillbeeConfig(db.prisma, { LEC_AUTH_SECRET: SECRET })).config).toBeNull();
    await saveBillbeeCredentials(db.prisma, CREDS, SECRET);
    expect((await loadBillbeeConfig(db.prisma, { LEC_AUTH_SECRET: "anderer" })).config).toBeNull();
    expect((await loadBillbeeConfig(db.prisma, {})).config).toBeNull();
  });

  it("verweigert Speichern ohne Geheimnis und kann entfernen", async () => {
    await expect(saveBillbeeCredentials(db.prisma, CREDS, undefined)).rejects.toBeInstanceOf(MissingSecretError);
    await saveBillbeeCredentials(db.prisma, CREDS, SECRET);
    await deleteBillbeeCredentials(db.prisma);
    expect((await loadBillbeeConfig(db.prisma, { LEC_AUTH_SECRET: SECRET })).config).toBeNull();
  });
});
