import { describe, expect, it } from "vitest";
import type { ArticleAggregate, WindowAggregate } from "../dashboard/viewModel";
import type { LatestQuote } from "../dashboard/marketComparison";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
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
  return { priceFrom: trend * 0.8, priceTrend: trend, priceAvg30: trend, priceAvg7: trend, priceAvg1: null, available: 10, fetchedAt: new Date(), matchQuality: "eindeutig", ...extra };
}

describe("marketHints", () => {
  it("zaehlt zu guenstig / zu teuer / EK ueber Markt und summiert liegengelassenes Geld", () => {
    // Markt-EK 5,00 € -> Zielspanne 25 %..33 % Deckungsbeitrag, handgerechnet. Das Einschreiben
    // haengt am Shop-Volumen: Fuellartikel (inaktiv, ohne Marktwert) macht N realistisch, sonst
    // lagen 100 Marken auf 6 Stueck (39 € je Stueck) und jede Spanne waere absurd.
    const market = 5;
    const shopUnits = 3400 + 6;
    const registered = (100 * 2.35) / shopUnits;
    const hk = 5 + 0.575 + 0.67 + 0.053 + registered;
    const min = (0.35 + hk) / (1 - (0.11 + 0.09) * 1.19 - 0.25);
    const opt = (0.35 + hk) / (1 - (0.11 + 0.1) * 1.19 - 0.33);
    const cheap = article("1", 8, 4, 6); // deutlich unter der Spanne
    const ok = article("2", Math.round((min + opt) / 2 * 100) / 100, 1);
    const dear = article("3", 40, 2);
    const noQuote = article("4", 9, 1);
    const filler: ArticleAggregate = { ...article("9", 6, 0), active: false, windows: { "365": win(3400, 3400 * 6, 0) } };
    const ekHigh: ArticleAggregate = { ...article("5", Math.round((min + opt) / 2 * 100) / 100, 1), currentEk: 20, windows: {} };
    const quotes = new Map<string, LatestQuote>([
      ["1", quote(market)],
      ["2", quote(market)],
      ["3", quote(market)],
      ["5", quote(market, { fetchedAt: new Date(Date.now() - 40 * 86400000) })],
    ]);
    const h = computeMarketHints([cheap, ok, dear, noQuote, ekHigh, filler], quotes, DEFAULT_COST_SETTINGS, new Map());
    expect(h.withQuote).toBe(4);
    expect(h.activeTotal).toBe(5);
    expect(h.coverage).toBeCloseTo(0.8);
    expect(h.tooCheap).toBe(1);
    expect(h.tooExpensive).toBe(1);
    expect(h.ekAboveMarket).toBe(1);
    expect(h.stale).toBe(1);
    expect(h.topTooCheap[0].articleId).toBe("1");
    expect(h.topTooCheap[0].lever).toBe(6);
    expect(h.tooCheapEffect).toBeCloseTo((min - 8) * 6, 1);
    expect(h.topTooCheap[0].targetMin).toBeCloseTo(min, 2);
    expect(h.topTooCheap[0].targetOpt).toBeCloseTo(opt, 2);
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
