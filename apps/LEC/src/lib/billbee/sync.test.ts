import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../pipeline/testDb";
import { BillbeeNotConfigured, syncBillbee } from "./sync";

const CONFIG = { apiKey: "K", user: "u", password: "p", baseUrl: "https://example.test/api/v1" };
const NOW = new Date("2026-10-13T12:00:00Z");
const A = "Yu-Gi-Oh! ABCD-DE001 Alpha Rare NM";
const B = "Yu-Gi-Oh! ABCD-DE002 Beta Rare NM";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

/** Fake-Billbee: ein Artikel-Stamm mit A (aktiv) und einer Bestellung. */
function fakeBillbee(products: unknown[]): typeof fetch {
  return (async (url: URL) => {
    const p = new URL(String(url)).pathname;
    if (p.endsWith("/products")) return json({ Paging: { TotalPages: 1 }, Data: products });
    if (p.endsWith("/orders"))
      return json({
        Paging: { TotalPages: 1 },
        Data: [{ CreatedAt: "2026-10-05T10:00:00Z", State: 4, OrderItems: [{ Quantity: 2, TotalPrice: 11, Product: { Title: A, SKU: "A" } }] }],
      });
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("syncBillbee", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.cleanup();
  });

  it("verlangt Zugangsdaten", async () => {
    await expect(syncBillbee(db.prisma, { config: null })).rejects.toBeInstanceOf(BillbeeNotConfigured);
  });

  it("schreibt Bestand, VK, EK und die drei Fenster; Rest wird ausgelaufen", async () => {
    // B existiert schon (aktiv), steht aber nicht mehr im Stamm.
    await db.prisma.article.create({ data: { nameNormalized: "abcd-de002 beta rare", nameRaw: B, setCode: "ABCD-DE002", packQty: 1, isCard: true, active: true } });

    const report = await syncBillbee(db.prisma, {
      config: CONFIG,
      now: NOW,
      minGapMs: 0,
      sleep: async () => {},
      fetchFn: fakeBillbee([{ Id: 1, SKU: "A", Title: A, Price: 6.99, CostPrice: 2.5, StockCurrent: 4 }]),
    });

    expect(report.products).toBe(1);
    expect(report.orders).toBe(1);
    expect(report.windows.map((w) => `${w.window}:${w.units}`)).toEqual(["30:2", "90:2", "365:2"]);

    const articles = await db.prisma.article.findMany({ orderBy: { nameRaw: "asc" } });
    const a = articles.find((x) => x.nameRaw === A)!;
    expect(a).toMatchObject({ stock: 4, currentVk: 6.99, currentEk: 2.5, active: true });
    expect(articles.find((x) => x.nameRaw === B)!.active).toBe(false);
    expect(report.deactivated).toBe(1);

    const w30 = await db.prisma.saleWindow.findFirst({ where: { articleId: a.id, window: "30" } });
    expect(w30).toMatchObject({ qty: 2, revenue: 11, ek: 5, dbI: 6 });

    // Einzelverkaeufe: eine Bestellposition = ein Datensatz, mit Datum und Preis je Stueck
    expect(report.sales).toBe(1);
    const sales = await db.prisma.sale.findMany({ where: { articleId: a.id } });
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ qty: 2, source: "billbee-api" });
    expect(sales[0].unitPrice).toBeCloseTo(5.5, 5);
    expect(sales[0].soldAt.toISOString()).toBe("2026-10-05T10:00:00.000Z");

    // zweiter Lauf: idempotent, genau ein Snapshot je Fenster
    await syncBillbee(db.prisma, { config: CONFIG, now: NOW, minGapMs: 0, sleep: async () => {}, fetchFn: fakeBillbee([{ Id: 1, SKU: "A", Title: A, Price: 6.99, CostPrice: 2.5, StockCurrent: 3 }]) });
    expect(await db.prisma.saleWindow.count({ where: { articleId: a.id } })).toBe(3);
    expect(await db.prisma.sale.count({ where: { articleId: a.id } })).toBe(1);
    expect((await db.prisma.article.findUnique({ where: { id: a.id } }))!.stock).toBe(3);
  });
});
