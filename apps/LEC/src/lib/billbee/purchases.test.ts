import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { purchasedQty, PURCHASE_SOURCE } from "./purchases";
import { syncBillbee } from "./sync";

const CONFIG = { apiKey: "K", user: "u", password: "p", baseUrl: "https://example.test/api/v1" };
const NOW = new Date("2026-10-13T12:00:00Z");
const A = "Yu-Gi-Oh! ABCD-DE001 Alpha Rare NM";
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

function fake(product: Record<string, unknown>, orderAt: string): typeof fetch {
  return (async (url: URL) => {
    const p = new URL(String(url)).pathname;
    if (p.endsWith("/products")) return json({ Paging: { TotalPages: 1 }, Data: [product] });
    if (p.endsWith("/orders"))
      return json({ Paging: { TotalPages: 1 }, Data: [{ CreatedAt: orderAt, State: 4, OrderNumber: "N1", OrderItems: [{ Quantity: 2, TotalPrice: 11, Product: { Title: A, SKU: "A" } }] }] });
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}
const prod = (stock: number, cost: number) => ({ Id: 1, SKU: "A", Title: A, Price: 6.99, CostPrice: cost, StockCurrent: stock });
const run = (db: TestDb, fetchFn: typeof fetch) => syncBillbee(db.prisma, { config: CONFIG, now: NOW, minGapMs: 0, sleep: async () => {}, fetchFn });

describe("purchasedQty", () => {
  it("Zuwachs ist der Einkauf", () => expect(purchasedQty(4, 10, 0)).toBe(6));
  it("zwischenzeitlich Verkauftes zaehlt mit", () => expect(purchasedQty(4, 8, 2)).toBe(6));
  it("kein Zuwachs: kein Einkauf", () => {
    expect(purchasedQty(4, 4, 0)).toBeNull();
    expect(purchasedQty(4, 3, 0)).toBeNull();
  });
});

describe("Einkaeufe aus dem Billbee-Abgleich", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it("erster Abgleich ist nur Ausgangsbestand, ein Zuwachs danach ist ein Einkauf zum neuen EK", async () => {
    const first = await run(db, fake(prod(4, 2.5), "2026-10-05T10:00:00Z"));
    expect(first.purchasesDetected).toBe(0);
    expect(await db.prisma.purchase.count()).toBe(0);

    const second = await run(db, fake(prod(10, 3), "2026-10-05T10:00:00Z"));
    expect(second.purchasesDetected).toBe(1);
    const p = await db.prisma.purchase.findFirstOrThrow();
    expect(p).toMatchObject({ qty: 6, unitEk: 3, source: PURCHASE_SOURCE });
  });

  it("gleicher EK bei mehr Bestand: Einkauf zum selben Preis", async () => {
    await run(db, fake(prod(4, 2.5), "2026-10-05T10:00:00Z"));
    await run(db, fake(prod(7, 2.5), "2026-10-05T10:00:00Z"));
    expect(await db.prisma.purchase.findFirstOrThrow()).toMatchObject({ qty: 3, unitEk: 2.5 });
  });

  it("weniger Bestand oder fehlender EK: kein Einkauf", async () => {
    await run(db, fake(prod(4, 2.5), "2026-10-05T10:00:00Z"));
    await run(db, fake(prod(2, 2.5), "2026-10-05T10:00:00Z"));
    await run(db, fake(prod(9, 0), "2026-10-05T10:00:00Z"));
    expect(await db.prisma.purchase.count()).toBe(0);
  });

  it("Verkaeufe zwischen den Abgleichen werden zum Zuwachs addiert", async () => {
    await run(db, fake(prod(4, 2.5), "2026-10-05T10:00:00Z"));
    // Bestellung (2 Stueck) liegt nach dem ersten Abgleich: Bestand 4 -> 8 heisst 6 gekauft, nicht 4
    await run(db, fake(prod(8, 2.5), "2099-01-01T10:00:00Z"));
    expect(await db.prisma.purchase.findFirstOrThrow()).toMatchObject({ qty: 6 });
  });
});
