import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

describe("session tokens", () => {
  it("erstellt ein Token, das mit demselben Secret gueltig ist", async () => {
    const token = await createSessionToken("test-secret-123");
    expect(await verifySessionToken(token, "test-secret-123")).toBe(true);
  });

  it("lehnt ein Token mit falschem Secret ab", async () => {
    const token = await createSessionToken("test-secret-123");
    expect(await verifySessionToken(token, "anderes-secret")).toBe(false);
  });

  it("lehnt manipulierte Tokens ab", async () => {
    const token = await createSessionToken("test-secret-123");
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered, "test-secret-123")).toBe(false);
  });

  it("lehnt abgelaufene Tokens ab", async () => {
    const token = await createSessionToken("test-secret-123", -10); // bereits abgelaufen
    expect(await verifySessionToken(token, "test-secret-123")).toBe(false);
  });

  it("lehnt strukturell ungueltige Tokens ab", async () => {
    expect(await verifySessionToken("kein-gueltiges-token", "test-secret-123")).toBe(false);
    expect(await verifySessionToken("", "test-secret-123")).toBe(false);
  });
});
