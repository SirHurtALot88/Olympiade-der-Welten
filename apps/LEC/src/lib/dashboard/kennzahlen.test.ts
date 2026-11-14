import { describe, expect, it } from "vitest";
import { capitalByGroup, daysToFirstSale, outOfStock, priceEffects, saleVsMarket } from "./kennzahlen";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("saleVsMarket", () => {
  const hist = [
    { at: d("2026-11-01"), priceAvg7: 10, priceTrend: 9 },
    { at: d("2026-11-10"), priceAvg7: null, priceTrend: 12 },
  ];
  it("nimmt den letzten Marktstand vor dem Verkauf und rechnet die Abweichung", () => {
    const r = saleVsMarket([{ soldAt: d("2026-11-03"), qty: 2, unitPrice: 8 }, { soldAt: d("2026-11-11"), qty: 1, unitPrice: 12 }], hist);
    expect(r.matched).toBe(2);
    expect(r.rows[0].market).toBe(10);
    expect(r.rows[0].diffPct).toBeCloseTo(-20);
    expect(r.rows[1].market).toBe(12);
    expect(r.leftOnTable).toBeCloseTo(4); // 2 x 2 EUR unter Markt
    expect(r.avgDiffPct).toBeCloseTo((-20 * 2 + 0) / 3);
  });
  it("ignoriert Verkaeufe ohne Marktstand in den 14 Tagen davor", () => {
    const r = saleVsMarket([{ soldAt: d("2026-10-20"), qty: 1, unitPrice: 5 }, { soldAt: d("2026-12-30"), qty: 1, unitPrice: 5 }], hist);
    expect(r.matched).toBe(0);
    expect(r.total).toBe(2);
    expect(r.avgDiffPct).toBeNull();
  });
});

describe("priceEffects", () => {
  const now = d("2026-11-14");
  it("erkennt schnelleren Absatz nach einer Senkung", () => {
    const sales = [d("2026-09-20"), d("2026-10-05"), d("2026-10-06"), d("2026-10-08"), d("2026-10-12")].map((s) => ({ soldAt: s, qty: 1, unitPrice: 5 }));
    const eff = priceEffects([{ at: d("2026-09-30"), before: 8, after: 5 }, { at: d("2026-08-01"), before: 8, after: 8.5 }], sales, now);
    expect(eff).toHaveLength(1);
    expect(eff[0].unitsBefore).toBe(1);
    expect(eff[0].unitsAfter).toBe(4);
    expect(eff[0].verdict).toBe("schneller");
  });
  it("ignoriert kleine Aenderungen und solche ohne 14 Tage Nachlauf", () => {
    expect(priceEffects([{ at: d("2026-11-01"), before: 8, after: 5 }], [], now)).toHaveLength(0);
    expect(priceEffects([{ at: d("2026-09-01"), before: 8, after: 8.4 }], [], now)).toHaveLength(0);
  });
  it("sagt zu wenig Daten bei weniger als zwei Verkaeufen", () => {
    const eff = priceEffects([{ at: d("2026-09-01"), before: 8, after: 5 }], [{ soldAt: d("2026-10-01"), qty: 1, unitPrice: 5 }], now);
    expect(eff[0].verdict).toBe("zu_wenig_daten");
  });
});

describe("outOfStock", () => {
  const now = d("2026-11-14");
  it("zaehlt Tage mit Bestand 0 und schaetzt verpasste Verkaeufe", () => {
    const moves = [
      { at: d("2026-10-01"), before: 2, after: 0 },
      { at: d("2026-10-21"), before: 0, after: 3 },
    ];
    const sales = [d("2026-08-01"), d("2026-09-01")].map((s) => ({ soldAt: s, qty: 1, unitPrice: 5 }));
    const r = outOfStock(moves, 3, sales, d("2026-07-01"), now, 365);
    expect(r.daysOut).toBeCloseTo(20, 0);
    expect(r.daysIn + r.daysOut).toBeCloseTo(136, 0);
    expect(r.perMonthInStock).not.toBeNull();
    expect(r.missedUnits).toBeGreaterThan(0);
  });
  it("beginnt das Fenster erst bei der Erfassung und nimmt ohne Bewegung den heutigen Bestand", () => {
    const r = outOfStock([], 0, [], d("2026-11-04"), now, 365);
    expect(r.daysOut).toBeCloseTo(10, 0);
    expect(r.outShare).toBe(1);
    const s = outOfStock([], 5, [], d("2026-11-04"), now, 365);
    expect(s.daysOut).toBe(0);
  });
});

describe("daysToFirstSale", () => {
  it("zaehlt ab der Erfassung, Altverkaeufe zaehlen nicht", () => {
    const r = daysToFirstSale(d("2026-10-01"), [{ soldAt: d("2026-09-01"), qty: 1, unitPrice: 1 }, { soldAt: d("2026-10-11"), qty: 1, unitPrice: 1 }], d("2026-11-14"));
    expect(r).toEqual({ days: 10, waiting: false });
  });
  it("zaehlt ohne Verkauf die Wartezeit", () => {
    expect(daysToFirstSale(d("2026-11-04"), [], d("2026-11-14"))).toEqual({ days: 10, waiting: true });
  });
});

describe("capitalByGroup", () => {
  it("summiert Kapital, Ladenhueter-Anteil und Umschlag je Gruppe", () => {
    const g = capitalByGroup([
      { active: true, stock: 2, ek: 5, units365: 4, lifecycle: null, group: "Ordner 1" },
      { active: true, stock: 4, ek: 2.5, units365: 0, lifecycle: "auslisten", group: "Ordner 1" },
      { active: true, stock: 1, ek: 0, ekMissing: true, units365: 1, group: "Ordner 1" },
      { active: true, stock: 0, ek: 9, units365: 9, group: "Ordner 1" },
      { active: false, stock: 3, ek: 3, units365: 0, group: "Ordner 2" },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].capital).toBe(20);
    expect(g[0].stuckCapital).toBe(10);
    expect(g[0].stuckShare).toBe(0.5);
    expect(g[0].withoutEk).toBe(1);
    expect(g[0].turnsPerYear).toBeCloseTo(1); // 4 x 5 EUR Wareneinsatz / 20 EUR Kapital
    expect(g[0].daysOfCover).toBeCloseTo(365);
  });
});
