import { describe, expect, it } from "vitest";
import { mapOrders, mapProduct, titleOf } from "./map";

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
    expect(res.map((r) => r.window)).toEqual(["30", "90", "365"]);
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
