import { describe, expect, it } from "vitest";
import { DYN, dynamicMargin, roundToStep99, soldPerYear } from "./dynamicVk";

const base = { paceMonth: null, stock: 3, marketValue: 5, trend7vs30: null, fromVsTrend: null, salesSincePriceChange: null, daysSincePriceChange: null };

describe("dynamicMargin", () => {
  it("ohne Signal 28 %", () => {
    expect(dynamicMargin(base).margin).toBeCloseTo(0.28);
  });
  it("schneller Abverkauf bei knappem Bestand: hoeher; langsam und viel Bestand: niedriger", () => {
    // Marktwert 5 € -> Soll 4/Jahr; Tempo 1/Monat = 12/Jahr = Verhaeltnis 3 -> +5; Reichweite 2 Monate bei Bestand 2 -> +3
    expect(dynamicMargin({ ...base, paceMonth: 1, stock: 2 }).margin).toBeCloseTo(0.36);
    // Tempo 0,1/Monat = 1,2/Jahr, Verhaeltnis 0,3 -> -3; Reichweite 30 Monate -> -4
    expect(dynamicMargin({ ...base, paceMonth: 0.1, stock: 3 }).margin).toBeCloseTo(0.21);
  });
  it("Markt: fallender Preis und billiges Angebot senken, nur ab 2 € Marktwert", () => {
    expect(dynamicMargin({ ...base, trend7vs30: -0.2, fromVsTrend: 0.4 }).margin).toBeCloseTo(0.23);
    expect(dynamicMargin({ ...base, marketValue: 1, trend7vs30: -0.2, fromVsTrend: 0.4 }).margin).toBeCloseTo(0.28);
  });
  it("Preisbeweis: zwei Verkaeufe in 60 Tagen heben, keine trotz erwartetem Tempo senken", () => {
    expect(dynamicMargin({ ...base, salesSincePriceChange: 2, daysSincePriceChange: 30 }).margin).toBeCloseTo(0.31);
    expect(dynamicMargin({ ...base, paceMonth: 1, stock: 20, salesSincePriceChange: 0, daysSincePriceChange: 90 }).parts.beweis).toBe(-2);
  });
  it("bleibt in 15 bis 40 %", () => {
    const hi = dynamicMargin({ ...base, paceMonth: 5, stock: 1, trend7vs30: 0.3, salesSincePriceChange: 5, daysSincePriceChange: 20 });
    expect(hi.margin).toBeLessThanOrEqual(DYN.max);
    const lo = dynamicMargin({ ...base, paceMonth: 0.05, stock: 30, trend7vs30: -0.3, fromVsTrend: 0.3, salesSincePriceChange: 0, daysSincePriceChange: 400 });
    expect(lo.margin).toBeGreaterThanOrEqual(DYN.min);
  });
  it("Soll je Preisband", () => {
    expect([soldPerYear(5), soldPerYear(10), soldPerYear(25), soldPerYear(80)]).toEqual([4, 3, 2, 1]);
  });
});

describe("roundToStep99", () => {
  it("rundet auf .99 in Stufen und nie unter 4,99", () => {
    expect(roundToStep99(6.4)).toBe(5.99);
    expect(roundToStep99(6.6)).toBe(6.99);
    expect(roundToStep99(12.4)).toBe(11.99);
    expect(roundToStep99(37.4)).toBe(34.99);
    expect(roundToStep99(37.6)).toBe(39.99);
    expect(roundToStep99(2)).toBe(4.99);
  });
});
