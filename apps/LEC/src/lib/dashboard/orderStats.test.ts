import { describe, expect, it } from "vitest";
import { MIN_ORDERS_FOR_MEASURE, orderStats } from "./orderStats";

describe("orderStats", () => {
  it("zaehlt Bestellungen und Artikel je Bestellung, ignoriert Verkaeufe ohne Bestellnummer", () => {
    const sales: { orderRef: string | null; qty: number }[] = Array.from({ length: MIN_ORDERS_FOR_MEASURE }, (_, i) => ({ orderRef: `B${i}`, qty: 1 }));
    sales.push({ orderRef: "B0", qty: 2 }, { orderRef: null, qty: 50 });
    const r = orderStats(sales);
    expect(r.orders).toBe(MIN_ORDERS_FOR_MEASURE);
    expect(r.units).toBe(MIN_ORDERS_FOR_MEASURE + 2);
    expect(r.itemsPerOrder).toBeCloseTo((MIN_ORDERS_FOR_MEASURE + 2) / MIN_ORDERS_FOR_MEASURE);
  });
  it("gibt bei zu wenigen Bestellungen keinen Messwert zurueck", () => {
    expect(orderStats([{ orderRef: "A", qty: 3 }]).itemsPerOrder).toBeNull();
    expect(orderStats([]).itemsPerOrder).toBeNull();
  });
});
