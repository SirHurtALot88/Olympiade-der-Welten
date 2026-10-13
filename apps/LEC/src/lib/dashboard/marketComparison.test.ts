import { describe, expect, it } from "vitest";
import { buildMarketComparisonRow, type LatestQuote } from "./marketComparison";
import type { ArticleAggregate } from "./viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
import { registeredRateBelowThreshold } from "../pricing/costEngine";

function article(overrides: Partial<ArticleAggregate> = {}): ArticleAggregate {
  return {
    articleId: "a1",
    nameRaw: "Yu-Gi-Oh! TEST-DE001 Testkarte",
    setCode: "TEST-DE001",
    packQty: 1,
    stock: 0,
    active: true,
    currentVk: null,
    currentEk: null,
    latestMarketTrend: null,
    windows: {},
    ...overrides,
  };
}

function quote(overrides: Partial<LatestQuote> = {}): LatestQuote {
  return {
    priceFrom: null,
    priceTrend: null,
    priceAvg30: null,
    priceAvg7: null,
    priceAvg1: null,
    available: null,
    fetchedAt: new Date(),
    ...overrides,
  };
}

describe("buildMarketComparisonRow", () => {
  it("nutzt den aktuellen Listen-VK, wenn vorhanden (sonst realisierten Ø-VK)", () => {
    const a = article({
      currentVk: 9.99,
      windows: {
        "365": { qty: 5, revenue: 25, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 15, dbII: 10, fixedCostShare: 0, avgPrice: 5, rank: null },
      },
    });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, null);
    expect(row.ownVk).toBeCloseTo(9.99);
  });

  it("faellt auf den realisierten Ø-VK zurueck, wenn kein Listen-VK gepflegt ist", () => {
    const a = article({
      windows: {
        "365": { qty: 5, revenue: 25, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 15, dbII: 10, fixedCostShare: 0, avgPrice: 5, rank: null },
      },
    });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, null);
    expect(row.ownVk).toBeCloseTo(5);
  });

  it("klassifiziert 'zu teuer' bei eigenem VK deutlich ueber dem Markt-Trend", () => {
    const a = article({ currentVk: 5 });
    const row = buildMarketComparisonRow(a, quote({ priceTrend: 1 }), DEFAULT_COST_SETTINGS, null);
    expect(row.status).toBe("zu_teuer");
    expect(row.deltaPercent).toBeGreaterThan(0);
  });

  it("bleibt neutral ('im_korridor') ohne Markt-Trend (kein erfundener Vergleich)", () => {
    const a = article({ currentVk: 5 });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, null);
    expect(row.status).toBe("im_korridor");
    expect(row.deltaPercent).toBeNull();
  });

  it("leitet den Markt-EK aus 'ab' x Packgroesse + Einkaufs-Versand ab (KONZEPT §7.2)", () => {
    const a = article({ packQty: 3 });
    const row = buildMarketComparisonRow(a, quote({ priceFrom: 0.59 }), DEFAULT_COST_SETTINGS, null);
    // Pack-Einkaufs-Versand faellt EINMALIG an (3er-Pack = 1 Versandeinheit,
    // Chris' Vorgabe) -> 1.15 (Staffel <5 Stk) x 50 % Anteil, NICHT x Packgroesse.
    expect(row.marketEk).toBeCloseTo(0.59 * 3 + 1.15 * 0.5);
  });

  it("reicht die shopweiten Fixkosten in den Korridor durch (nicht 0)", () => {
    // Regression: marketComparison uebergab fixedCostPerUnit: 0 -> Korridor ohne Fixkosten.
    const a = article({
      currentVk: 9.99,
      windows: {
        "365": { qty: 5, revenue: 50, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 40, dbII: 30, fixedCostShare: 0, avgPrice: 10, rank: null },
      },
    });
    const shop = { units365d: 3400, unitsAtOrAboveThreshold: 60 };
    const ohne = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, null);
    const mit = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, shop);
    const fixedPerUnit = 4229 / 3400;
    const einschreiben = registeredRateBelowThreshold(shop, DEFAULT_COST_SETTINGS); // VK 9,99 liegt unter der Schwelle
    // VK-MIN = (HK + Gebuehren) x 1,33 -> Fixkosten und Einschreiben-Anteil gehen mit Faktor 1,33 ein.
    expect(mit.corridor.min - ohne.corridor.min).toBeCloseTo((fixedPerUnit + einschreiben) * 1.33, 5);
  });

  it("markiert einen Datensatz aelter als 30 Tage als veraltet", () => {
    const a = article();
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const row = buildMarketComparisonRow(a, quote({ fetchedAt: oldDate }), DEFAULT_COST_SETTINGS, null);
    expect(row.stale).toBe(true);
  });

  it("markiert einen frischen Datensatz nicht als veraltet", () => {
    const a = article();
    const row = buildMarketComparisonRow(a, quote({ fetchedAt: new Date() }), DEFAULT_COST_SETTINGS, null);
    expect(row.stale).toBe(false);
  });
});
