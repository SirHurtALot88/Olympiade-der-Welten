import { describe, expect, it } from "vitest";
import { ebayItemIdOf, stockLimitsOf, extractSales, mapOrders, mapProduct, titleOf } from "./map";

const NOW = new Date("2026-10-13T12:00:00Z");

describe("titleOf", () => {
  it("liest Text, Sprachliste und Objekt", () => {
    expect(titleOf(" Hallo ")).toBe("Hallo");
    expect(titleOf([{ LanguageCode: "EN", Text: "Hi" }, { LanguageCode: "DE", Text: "Hallo" }])).toBe("Hallo");
    expect(titleOf([{ LanguageCode: "EN", Text: "Hi" }])).toBe("Hi");
    expect(titleOf({ Text: "X" })).toBe("X");
    expect(titleOf(undefined)).toBe("");
  });
});

describe("mapProduct", () => {
  it("mappt Bestand, VK, EK und Set-Code", () => {
    const m = mapProduct({ Id: 7, SKU: "A-1", Title: [{ LanguageCode: "DE", Text: "Yu-Gi-Oh! MAMA-DE047 Magatama Secret Rare NM" }], Price: 12.5, CostPrice: "6,25", StockCurrent: 3.0 });
    expect(m).toMatchObject({ sku: "A-1", id: "7", cost: 6.25 });
    expect(m!.row).toMatchObject({ setCode: "MAMA-DE047", stock: 3, currentVk: 12.5, currentEk: 6.25 });
  });
  it("ueberspringt Titellose und Deaktivierte", () => {
    expect(mapProduct({ Title: "" })).toBeNull();
    expect(mapProduct({ Title: "Yu-Gi-Oh! ABCD-DE001 X", IsDeactivated: true })).toBeNull();
  });
});

const item = (title: string, quantity: number, total: number, extra: object = {}) => ({
  Quantity: quantity,
  TotalPrice: total,
  Product: { Title: title, SKU: "S-" + title.length, ...extra },
});
const A = "Yu-Gi-Oh! ABCD-DE001 Alpha Rare NM";
const B = "Yu-Gi-Oh! ABCD-DE002 Beta Rare NM";

describe("mapOrders", () => {
  const masters = [mapProduct({ SKU: "S-" + A.length, Title: A, CostPrice: 2 })!];
  const orders = [
    { CreatedAt: "2026-10-10T08:00:00Z", State: 4, OrderItems: [item(A, 2, 10)] }, // 3 Tage alt
    { CreatedAt: "2026-09-01T08:00:00Z", State: 4, OrderItems: [item(A, 1, 4.5), item(B, 3, 9, { CostPrice: 1.5 })] }, // 42 Tage
    { CreatedAt: "2026-02-01T08:00:00Z", State: 4, OrderItems: [item(A, 4, 20)] }, // 254 Tage
    { CreatedAt: "2026-10-11T08:00:00Z", State: 8, OrderItems: [item(A, 9, 99)] }, // storniert
    { CreatedAt: "2025-01-01T08:00:00Z", State: 4, OrderItems: [item(A, 5, 50)] }, // zu alt
  ];
  const res = mapOrders(orders, masters, { now: NOW, excludeStates: [8] });
  const by = (w: string, name: string) => res.find((r) => r.window === w)!.rows.find((r) => r.nameRaw === name);

  it("teilt in 30/90/365 Tage", () => {
    expect(res.map((r) => r.window)).toEqual(["30", "90", "365", "all"]);
    expect(res[0].windowFrom.toISOString().slice(0, 10)).toBe("2026-09-13");
    expect(res[0].windowTo.toISOString().slice(0, 10)).toBe("2026-10-13");
  });
  it("summiert je Fenster, EK aus Artikelstamm bzw. Position, ohne Stornos", () => {
    // 30 Tage: nur Bestellung 1 -> 2 Stk, 10 EUR, EK 2*2 = 4
    expect(by("30", A)).toMatchObject({ qty: 2, revenue: 10, ek: 4, marge: 6 });
    expect(by("30", B)).toBeUndefined();
    // 90 Tage: 2+1 Stk, 14,5 EUR, EK 3*2 = 6; B: 3 Stk, 9 EUR, EK 3*1,5 = 4,5
    expect(by("90", A)).toMatchObject({ qty: 3, revenue: 14.5, ek: 6 });
    expect(by("90", B)).toMatchObject({ qty: 3, revenue: 9, ek: 4.5 });
    // 365 Tage: 2+1+4 Stk, 34,5 EUR
    expect(by("365", A)).toMatchObject({ qty: 7, revenue: 34.5, ek: 14 });
  });
});

describe("extractSales", () => {
  it("liefert je Bestellposition Datum, Menge und Preis je Stueck, ohne Stornos", () => {
    const sales = extractSales(
      [
        { CreatedAt: "2026-10-10T08:00:00Z", State: 4, OrderNumber: "1001", OrderItems: [item(A, 2, 25.98), item(B, 1, 4.5)] },
        { CreatedAt: "2026-10-11T08:00:00Z", State: 8, OrderItems: [item(A, 9, 99)] },
        { CreatedAt: "kaputt", State: 4, OrderItems: [item(A, 1, 5)] },
      ],
      { excludeStates: [8] }
    );
    expect(sales).toHaveLength(2);
    expect(sales[0]).toMatchObject({ qty: 2, orderRef: "1001" });
    expect(sales[0].unitPrice).toBeCloseTo(12.99, 5);
    expect(sales[0].soldAt.toISOString()).toBe("2026-10-10T08:00:00.000Z");
    expect(sales[1]).toMatchObject({ qty: 1, unitPrice: 4.5 });
  });
});

describe("Bestell-Pruefung", () => {
  const order = (id: number, qty: number, type?: number) => ({
    Id: id,
    CreatedAt: "2026-10-01T10:00:00Z",
    OrderItems: [{ Quantity: qty, TotalPrice: 2 * qty, Product: { Title: "Karte A", Type: type } }],
  });

  it("zaehlt doppelt gelieferte Bestellungen nur einmal", async () => {
    const { dedupeOrders } = await import("./map");
    const r = dedupeOrders([order(1, 1), order(2, 1), order(1, 1)]);
    expect(r.orders).toHaveLength(2);
    expect(r.duplicates).toBe(1);
  });

  it("ueberspringt Versandpositionen und meldet gebrochene Mengen", async () => {
    const { extractSales, diagnoseOrders } = await import("./map");
    const orders = [order(1, 2), order(2, 1, 3), order(3, 1.5)];
    expect(extractSales(orders)).toHaveLength(2);
    const d = diagnoseOrders(orders, 0);
    expect(d.fractionalItems).toBe(1);
    expect(d.top[0]).toMatchObject({ units: 3.5, orders: 2, maxLine: 2 });
  });
});

describe("ebayItemIdOf", () => {
  it("liest die eBay-Artikelnummer aus den Quellen, nicht andere Marktplaetze oder krumme IDs", () => {
    expect(ebayItemIdOf({ Sources: [{ Source: "Amazon", SourceId: "B0123456789" }, { Source: "eBay", ApiAccountName: "lec", SourceId: "226616298122" }] })).toBe("226616298122");
    expect(ebayItemIdOf({ Sources: [{ Source: "eBay", SourceId: "abc" }] })).toBeNull();
    expect(ebayItemIdOf({})).toBeNull();
  });
});

describe("stockLimitsOf", () => {
  it("liest Meldebestand und Soll-Bestand, 0 oder fehlend gilt als nicht gepflegt", () => {
    expect(stockLimitsOf({ StockWarning: 2, StockDesired: 6 })).toEqual({ minStock: 2, desiredStock: 6 });
    expect(stockLimitsOf({ StockMinimum: "3" })).toEqual({ minStock: 3, desiredStock: null });
    expect(stockLimitsOf({ StockWarning: 0, StockDesired: 0 })).toEqual({ minStock: null, desiredStock: null });
    expect(stockLimitsOf({})).toEqual({ minStock: null, desiredStock: null });
  });
});

describe("summarizeRecentOrders", () => {
  it("zeigt Nummer, Status, Ausschluss und ob zur Position ein Artikel existiert", async () => {
    const { summarizeRecentOrders } = await import("./map");
    const now = new Date("2026-11-13T12:00:00Z");
    const orders = [
      { OrderNumber: "16-1", BillBeeOrderId: 1, CreatedAt: "2026-11-12T10:00:00Z", State: 4, OrderItems: [{ Quantity: 1, TotalPrice: 21.99, Product: { Title: "Yu-Gi-Oh! DUPO-DE002 Dunkle Kavallerie Ultra Rare 1st NM" } }] },
      { OrderNumber: "16-2", BillBeeOrderId: 2, CreatedAt: "2026-11-11T10:00:00Z", State: 8, OrderItems: [{ Quantity: 1, TotalPrice: 5, Product: { Title: "Unbekannt X" } }] },
      { OrderNumber: "16-OLD", BillBeeOrderId: 3, CreatedAt: "2025-01-01T10:00:00Z", State: 4, OrderItems: [] },
    ];
    const r = summarizeRecentOrders(orders, now, (n) => n.includes("dunkle kavallerie"), { excludeStates: [8] });
    expect(r.map((o) => o.nr)).toEqual(["16-1", "16-2"]);
    expect(r[0].lines[0]).toMatchObject({ qty: 1, article: true });
    expect(r[0].lines[0].unitPrice).toBeCloseTo(21.99);
    expect(r[1].excluded).toBe(true);
    expect(r[1].lines[0].article).toBe(false);
  });
});

describe("matchSaleBySetCode", () => {
  const rarityOf = (n: string) => (/ultra/i.test(n) ? "Ultra Rare" : /secret/i.test(n) ? "Secret Rare" : null);
  it("ordnet ueber den Set-Code zu, wenn genau ein Artikel ihn traegt", async () => {
    const { matchSaleBySetCode } = await import("./map");
    const arts = [{ id: "a", setCode: "DUPO-DE002", nameRaw: "Yu-Gi-Oh! DUPO-DE002 Dunkle Kavallerie Ultra Rare 1st NM" }, { id: "b", setCode: "DUPO-DE003", nameRaw: "x" }];
    expect(matchSaleBySetCode("Yu-Gi-Oh! DUPO-DE002 Dunkle Kavallerie Ultra Rare 1st EX", arts, rarityOf)).toBe("a");
    expect(matchSaleBySetCode("Kein Code hier", arts, rarityOf)).toBeNull();
    expect(matchSaleBySetCode("Yu-Gi-Oh! ZZZZ-DE001 Unbekannt", arts, rarityOf)).toBeNull();
  });
  it("bei mehreren Artikeln mit dem Code entscheidet die Seltenheit, sonst nichts", async () => {
    const { matchSaleBySetCode } = await import("./map");
    const arts = [{ id: "u", setCode: "AB01-DE001", nameRaw: "AB01-DE001 X Ultra Rare" }, { id: "s", setCode: "AB01-DE001", nameRaw: "AB01-DE001 X Secret Rare" }];
    expect(matchSaleBySetCode("AB01-DE001 X Secret Rare NM", arts, rarityOf)).toBe("s");
    expect(matchSaleBySetCode("AB01-DE001 X NM", arts, rarityOf)).toBeNull();
  });
});

describe("makeCanonicalizer: Zwillings-Artikel vermeiden", () => {
  it("ordnet eine Bestellposition mit abweichendem Namen dem Stammartikel mit gleichem Set-Code zu", async () => {
    const { makeCanonicalizer, mapOrders: mapO, extractSales: extract } = await import("./map");
    const master = { row: { nameRaw: "Yu-Gi-Oh! DUPO-DE002 Dunkle Kavallerie Ultra Rare 1st NM", nameNormalized: "dupo-de002 dunkle kavallerie ultra rare 1st", packQty: 1, setCode: "DUPO-DE002", isCard: true, stock: 4, currentVk: 11.99, currentEk: 2, statusRaw: null }, sku: null, id: null, cost: 2, ebayItemId: null, minStock: null, desiredStock: null };
    const canonical = makeCanonicalizer([master], () => "Ultra Rare");
    const orders = [{ CreatedAt: "2026-11-01T10:00:00Z", State: 4, OrderNumber: "N1", OrderItems: [{ Quantity: 1, TotalPrice: 21.99, Product: { Title: "Yu-Gi-Oh! DUPO-DE002 Dunkle Kavallerie Rare Played" } }] }];
    const sales = extract(orders, { canonical });
    expect(sales[0].nameNormalized).toBe(master.row.nameNormalized);
    const res = mapO(orders, [master], { now: new Date("2026-11-13T00:00:00Z"), canonical });
    const names = res.flatMap((r) => r.rows.map((x) => x.nameNormalized));
    expect(new Set(names)).toEqual(new Set([master.row.nameNormalized]));
    // ohne Canonicalizer entsteht der Zwilling
    const plain = mapO(orders, [master], { now: new Date("2026-11-13T00:00:00Z") });
    expect(plain.flatMap((r) => r.rows.map((x) => x.nameNormalized))[0]).not.toBe(master.row.nameNormalized);
  });
});
