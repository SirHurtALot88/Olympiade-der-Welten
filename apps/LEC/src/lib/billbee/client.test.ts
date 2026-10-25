import { describe, expect, it } from "vitest";
import { BillbeeClient, BillbeeError, billbeeConfigFromEnv } from "./client";

const CONFIG = { apiKey: "KEY", user: "chris@example.de", password: "pw", baseUrl: "https://example.test/api/v1" };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const noSleep = async () => {};

describe("billbeeConfigFromEnv", () => {
  it("ist aus, solange ein Wert fehlt", () => {
    expect(billbeeConfigFromEnv({ BILLBEE_API_KEY: "k", BILLBEE_USER: "u" })).toBeNull();
    expect(billbeeConfigFromEnv({})).toBeNull();
  });
  it("liest alle drei Werte", () => {
    const c = billbeeConfigFromEnv({ BILLBEE_API_KEY: " k ", BILLBEE_USER: "u", BILLBEE_PASSWORD: "p" });
    expect(c).toMatchObject({ apiKey: "k", user: "u", password: "p" });
  });
});

describe("BillbeeClient", () => {
  it("sendet Basic-Auth und API-Schluessel", async () => {
    let seen: { url: string; headers: Headers } | null = null;
    const fetchFn = (async (url: URL, init: RequestInit) => {
      seen = { url: String(url), headers: new Headers(init.headers) };
      return json({ Data: [] });
    }) as unknown as typeof fetch;
    await new BillbeeClient(CONFIG, { fetchFn, sleep: noSleep }).get("/products", { page: 2 });
    expect(seen!.url).toBe("https://example.test/api/v1/products?page=2");
    expect(seen!.headers.get("authorization")).toBe("Basic " + Buffer.from("chris@example.de:pw").toString("base64"));
    expect(seen!.headers.get("x-billbee-api-key")).toBe("KEY");
  });

  it("holt alle Seiten", async () => {
    const pages = [
      { Paging: { TotalPages: 3 }, Data: [1, 2] },
      { Paging: { TotalPages: 3 }, Data: [3] },
      { Paging: { TotalPages: 3 }, Data: [4, 5] },
    ];
    let n = 0;
    const fetchFn = (async () => json(pages[n++])) as unknown as typeof fetch;
    const all = await new BillbeeClient(CONFIG, { fetchFn, sleep: noSleep }).getAll<number>("/orders");
    expect(all).toEqual([1, 2, 3, 4, 5]);
    expect(n).toBe(3);
  });

  it("wartet bei 429 nach Retry-After und wiederholt", async () => {
    const sleeps: number[] = [];
    let n = 0;
    const fetchFn = (async () => (n++ === 0 ? json({}, 429, { "retry-after": "3" }) : json({ Data: [9] }))) as unknown as typeof fetch;
    const c = new BillbeeClient(CONFIG, { fetchFn, minGapMs: 0, sleep: async (ms) => void sleeps.push(ms) });
    const body = await c.get<{ Data: number[] }>("/products");
    expect(body.Data).toEqual([9]);
    expect(sleeps).toContain(3000);
  });

  it("meldet 401 mit Hinweis und ohne Wiederholung", async () => {
    let n = 0;
    const fetchFn = (async () => (n++, json({}, 401))) as unknown as typeof fetch;
    const c = new BillbeeClient(CONFIG, { fetchFn, sleep: noSleep });
    await expect(c.get("/products")).rejects.toThrow(/401.*API-Passwort/);
    await expect(c.get("/products")).rejects.toBeInstanceOf(BillbeeError);
    expect(n).toBe(2);
  });

  it("gibt nach zu vielen 500ern auf", async () => {
    let n = 0;
    const fetchFn = (async () => (n++, json({}, 503))) as unknown as typeof fetch;
    await expect(new BillbeeClient(CONFIG, { fetchFn, sleep: noSleep, maxRetries: 2 }).get("/x")).rejects.toThrow(/503/);
    expect(n).toBe(3);
  });
});
