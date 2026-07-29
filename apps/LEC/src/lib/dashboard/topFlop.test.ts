import { describe, expect, it } from "vitest";
import { buildTopFlop, type ClassByArticleId } from "./topFlop";
import type { ArticleAggregate, WindowAggregate } from "./viewModel";

function agg(overrides: Partial<WindowAggregate> = {}): WindowAggregate {
  return {
    qty: 1,
    revenue: 10,
    ek: 3,
    ebayFeeTotal: 1,
    shippingCost: 1,
    dbI: 7,
    dbII: 5,
    avgPrice: 10,
    rank: null,
    ...overrides,
  };
}

function article(nameRaw: string, overrides: Partial<ArticleAggregate> = {}): ArticleAggregate {
  return {
    articleId: nameRaw,
    nameRaw,
    setCode: null,
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

describe("buildTopFlop", () => {
  // --- FIX 2 Regressionstest (eigene Fundstelle topFlop.ts, unabhaengig von viewModel.ts) ---
  it("REGRESSION FIX 2: ladenhueterBoundCapital ist Bestand x EK/Stk, nicht der Lebenszeit-EK verkaufter Stuecke", () => {
    const articles: ArticleAggregate[] = [
      article("Alter Renner", {
        active: true,
        stock: 1,
        currentEk: 2,
        // 50 verkaufte Stk, Lebenszeit-EK-Summe 500 € -- aber nur noch 1 Stk im Regal.
        windows: { all: agg({ qty: 50, revenue: 500, ek: 500 }) },
      }),
      article("Ausgelaufen ohne Bestandsimport", {
        active: false,
        stock: 0,
        currentEk: null,
        windows: { all: agg({ qty: 10, revenue: 100, ek: 100 }) },
      }),
    ];
    const classByArticleId: ClassByArticleId = {
      "Alter Renner": "ladenhueter",
      "Ausgelaufen ohne Bestandsimport": "ladenhueter",
    };
    const result = buildTopFlop(articles, classByArticleId, "90");

    expect(result.ladenhueterCount).toBe(2);
    // Nur "Alter Renner" hat einen Bestandsimport -> geht in Summe/Ranking ein.
    // Bestand 1 Stk x EK/Stk 2 € = 2 € -- NICHT die Lebenszeit-EK-Summe von 500 €
    // (der alte Fehler haette hier windows.all.ek = 500 verwendet).
    expect(result.ladenhueterBoundCapital).toBeCloseTo(2);
    expect(result.ladenhueterUnknownStockCount).toBe(1);
    expect(result.ladenhueter).toHaveLength(1);
    expect(result.ladenhueter[0].nameRaw).toBe("Alter Renner");
    expect(result.ladenhueter[0].barValue).toBeCloseTo(2);
  });

  it("laesst 'Ladenhueter' leer, wenn keiner klassifiziert ist", () => {
    const articles: ArticleAggregate[] = [article("Solide", { windows: { "90": agg({ qty: 5, revenue: 50 }) } })];
    const result = buildTopFlop(articles, {}, "90");
    expect(result.ladenhueter).toHaveLength(0);
    expect(result.ladenhueterBoundCapital).toBe(0);
    expect(result.ladenhueterUnknownStockCount).toBe(0);
  });
});
