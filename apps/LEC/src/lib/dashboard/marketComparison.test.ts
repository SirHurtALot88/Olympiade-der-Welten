import { describe, expect, it } from "vitest";
import { buildMarketComparisonRow, type LatestQuote } from "./marketComparison";
import type { ArticleAggregate } from "./viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";

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
        "365": { qty: 5, revenue: 25, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 15, dbII: 10, avgPrice: 5, rank: null },
      },
    });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS);
    expect(row.ownVk).toBeCloseTo(9.99);
  });

  it("faellt auf den realisierten Ø-VK zurueck, wenn kein Listen-VK gepflegt ist", () => {
    const a = article({
      windows: {
        "365": { qty: 5, revenue: 25, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 15, dbII: 10, avgPrice: 5, rank: null },
      },
    });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS);
    expect(row.ownVk).toBeCloseTo(5);
  });

  it("klassifiziert 'zu teuer' bei eigenem VK deutlich ueber dem Markt-Trend", () => {
    const a = article({ currentVk: 5 });
    const row = buildMarketComparisonRow(a, quote({ priceTrend: 1 }), DEFAULT_COST_SETTINGS);
    expect(row.status).toBe("zu_teuer");
    expect(row.deltaPercent).toBeGreaterThan(0);
  });

  it("bleibt neutral ('im_korridor') ohne Markt-Trend (kein erfundener Vergleich)", () => {
    const a = article({ currentVk: 5 });
    const row = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS);
    expect(row.status).toBe("im_korridor");
    expect(row.deltaPercent).toBeNull();
  });

  it("leitet den Markt-EK aus 'ab' x Packgroesse + Einkaufs-Versand ab (KONZEPT §7.2)", () => {
    const a = article({ packQty: 3 });
    const row = buildMarketComparisonRow(a, quote({ priceFrom: 0.59 }), DEFAULT_COST_SETTINGS);
    // Pack-Einkaufs-Versand: buyShippingFive (1.30) x Packgroesse (3) = 3.90.
    expect(row.marketEk).toBeCloseTo(0.59 * 3 + 1.3 * 3);
  });

  it("markiert einen Datensatz aelter als 30 Tage als veraltet", () => {
    const a = article();
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const row = buildMarketComparisonRow(a, quote({ fetchedAt: oldDate }), DEFAULT_COST_SETTINGS);
    expect(row.stale).toBe(true);
  });

  it("markiert einen frischen Datensatz nicht als veraltet", () => {
    const a = article();
    const row = buildMarketComparisonRow(a, quote({ fetchedAt: new Date() }), DEFAULT_COST_SETTINGS);
    expect(row.stale).toBe(false);
  });
});
