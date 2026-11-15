import { describe, expect, it } from "vitest";
import { YEAR_FACTS, feeYearChecks, yearMetrics } from "./betriebszahlen";
import { DEFAULT_COST_SETTINGS } from "./costSettings";

const f = (y: number) => YEAR_FACTS.find((x) => x.year === y)!;

describe("yearMetrics", () => {
  it("rechnet Warenkorb, Artikel je Bestellung und Quoten aus den genannten Zahlen", () => {
    const m = yearMetrics(f(2025));
    expect(m.basket).toBeCloseTo(23093.02 / 1944, 6);
    expect(m.itemsPerOrder).toBeCloseTo(3055 / 1944, 6);
    expect(m.purchaseAvg).toBeCloseTo(8656 / 968, 6);
    expect(m.purchaseQuote).toBeCloseTo(8656 / 24135.12, 6);
    expect(m.packagingPerOrder).toBeCloseTo(2870 / 1944, 6);
    expect(m.rest).toBeCloseTo(24135.12 - 7993.22 - 8656 - 2870, 6);
  });
  it("laesst fehlende Zahlen leer statt zu raten", () => {
    const m = yearMetrics(f(2022));
    expect(m.itemsPerOrder).toBeNull();
    expect(m.purchaseQuote).toBeNull();
    expect(m.rest).toBeNull();
    expect(yearMetrics(f(2026)).rest).toBeNull(); // eBay-Verkaufskosten 2026 fehlen noch
  });
  it("kuerzt den Umsatz 2026 auf den Einkaufszeitraum (bis 31.10.)", () => {
    expect(yearMetrics(f(2026)).purchaseQuote).toBeCloseTo(8061 / ((23448.7 * 304) / 318), 6);
  });
});

describe("feeYearChecks", () => {
  it("Modell plus Shop-Abo liegt 2024 und 2025 innerhalb von etwa einem Prozentpunkt des eBay-Werts", () => {
    const checks = feeYearChecks(YEAR_FACTS, DEFAULT_COST_SETTINGS);
    expect(checks.map((c) => c.year)).toEqual([2024, 2025]);
    for (const c of checks) {
      expect(c.modelTotal).toBeCloseTo(c.modelFees + 1140, 6);
      expect(Math.abs(c.diff) / c.revenue).toBeLessThan(0.012);
    }
  });
});
