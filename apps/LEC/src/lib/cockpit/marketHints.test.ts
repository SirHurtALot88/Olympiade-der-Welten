import { describe, expect, it } from "vitest";
import type { ArticleAggregate, WindowAggregate } from "../dashboard/viewModel";
import type { LatestQuote } from "../dashboard/marketComparison";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
import { formulaVk } from "../pricing/marketPrice";
import { computeMarketHints } from "./marketHints";

function win(qty: number, revenue: number, ek: number): WindowAggregate {
  return { qty, revenue, ek, ebayFeeTotal: 0, shippingCost: 0, dbI: revenue - ek, dbII: revenue - ek, fixedCostShare: 0, avgPrice: qty > 0 ? revenue / qty : 0, rank: null };
}

function article(id: string, currentVk: number, stock: number, qty90 = 0): ArticleAggregate {
  return {
    articleId: id,
    nameRaw: `Yu-Gi-Oh! T-DE${id} Karte`,
    setCode: `T-DE${id}`,
    packQty: 1,
    stock,
    active: true,
    currentVk,
    currentEk: 2,
    latestMarketTrend: null,
    windows: { "90": win(qty90, qty90 * currentVk, qty90 * 2), "365": win(qty90, qty90 * currentVk, qty90 * 2) },
  };
}

function quote(trend: number, extra: Partial<LatestQuote> = {}): LatestQuote {
  return { priceFrom: trend * 0.8, priceTrend: trend, priceAvg30: trend, priceAvg7: null, priceAvg1: null, available: 10, fetchedAt: new Date(), matchQuality: "eindeutig", ...extra };
}

describe("marketHints", () => {
  it("zaehlt zu guenstig / zu teuer / EK ueber Markt und summiert liegengelassenes Geld", () => {
    const market = 5; // Formel-VK = 5*3+0,99 = 15,99
    const cheap = article("1", 8, 4, 6); // deutlich unter Formel
    const ok = article("2", formulaVk(market), 1);
    const dear = article("3", 40, 2);
    const noQuote = article("4", 9, 1);
    const ekHigh: ArticleAggregate = { ...article("5", formulaVk(market), 1), currentEk: 20, windows: {} };
    const quotes = new Map<string, LatestQuote>([
      ["1", quote(market)],
      ["2", quote(market)],
      ["3", quote(market)],
      ["5", quote(market, { fetchedAt: new Date(Date.now() - 40 * 86400000) })],
    ]);
    const h = computeMarketHints([cheap, ok, dear, noQuote, ekHigh], quotes, DEFAULT_COST_SETTINGS, new Map());
    expect(h.withQuote).toBe(4);
    expect(h.activeTotal).toBe(5);
    expect(h.coverage).toBeCloseTo(0.8);
    expect(h.tooCheap).toBe(1);
    expect(h.tooExpensive).toBe(1);
    expect(h.ekAboveMarket).toBe(1);
    expect(h.stale).toBe(1);
    expect(h.topTooCheap[0].articleId).toBe("1");
    expect(h.topTooCheap[0].lever).toBe(6);
    expect(h.tooCheapEffect).toBeCloseTo((formulaVk(market) - 8) * 6);
    expect(h.topTooExpensive[0].articleId).toBe("3");
    expect(h.latestFetch).not.toBeNull();
  });

  it("mehrdeutige Marktwerte zaehlen separat und landen ohne Urteil nicht in den Top-Listen", () => {
    const a = article("1", 8, 4);
    const quotes = new Map<string, LatestQuote>([["1", quote(5, { matchQuality: "mehrdeutig", priceMin: 1, priceMax: 20, variants: 3 })]]);
    const h = computeMarketHints([a], quotes, DEFAULT_COST_SETTINGS, new Map());
    expect(h.ambiguous).toBe(1);
    expect(h.topTooCheap).toHaveLength(0);
    expect(h.topTooExpensive).toHaveLength(0);
  });
});
