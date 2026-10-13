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

  // Handgerechnet (unabhaengig vom Code), Einzelkarte, Markt-EK 2,00 €, kein Shop-Volumen:
  // HK = 2,00 + 0,575 (Einkaufs-Versand 1,15 x 50 %) + 0,67 + 0,053 = 3,298
  // 25 %: (0,35 + 3,298) / (1 - 0,11 x 1,19 - 0,09 x 1,19 - 0,25) = 7,125   (Anzeigen-Satz MIN 9 %)
  // 33 %: (0,35 + 3,298) / (1 - 0,11 x 1,19 - 0,10 x 1,19 - 0,33) = 8,684   (Anzeigen-Satz GUT 10 %)
  it("Zielspanne = 25 % bis 33 % Deckungsbeitrags-Marge auf Marktwert-EK plus Einkaufs-Versand", () => {
    const row = buildMarketComparisonRow(article({ currentVk: 8 }), quote({ priceAvg7: 2 }), DEFAULT_COST_SETTINGS, null);
    expect(row.marketValue).toBeCloseTo(2);
    expect(row.targetMin).toBeCloseTo(7.125, 2);
    expect(row.targetOpt).toBeCloseTo(8.684, 2);
    expect(row.status).toBe("im_korridor");
    expect(row.deltaPercent).toBe(0);
  });

  it("zu guenstig unter, zu teuer ueber der Spanne (je 3 % Toleranz)", () => {
    const guenstig = buildMarketComparisonRow(article({ currentVk: 4.99 }), quote({ priceAvg7: 2 }), DEFAULT_COST_SETTINGS, null);
    expect(guenstig.status).toBe("zu_guenstig");
    expect(guenstig.deltaPercent).toBeCloseTo((4.99 - 7.125) / 7.125, 3);
    const teuer = buildMarketComparisonRow(article({ currentVk: 11.99 }), quote({ priceAvg7: 2 }), DEFAULT_COST_SETTINGS, null);
    expect(teuer.status).toBe("zu_teuer");
    expect(teuer.deltaPercent).toBeCloseTo((11.99 - 8.684) / 8.684, 3);
    // knapp unter 7,125 (x,99-Rundung) ist noch keine Abweichung
    expect(buildMarketComparisonRow(article({ currentVk: 6.99 }), quote({ priceAvg7: 2 }), DEFAULT_COST_SETTINGS, null).status).toBe("im_korridor");
  });

  it("teure Karte: Marktdeckel 1,5-fach, 69,99 € bei Marktwert 47,83 € ist im Rahmen, 229,99 € bei 121,47 € ist zu teuer", () => {
    const dominus = buildMarketComparisonRow(article({ currentVk: 69.99 }), quote({ priceAvg7: 47.83 }), DEFAULT_COST_SETTINGS, null);
    expect(dominus.status).toBe("im_korridor");
    expect(dominus.marginReachable).toBe(false);
    expect(dominus.capped).toBe(true);
    const phara = buildMarketComparisonRow(article({ currentVk: 229.99 }), quote({ priceAvg7: 121.47 }), DEFAULT_COST_SETTINGS, null);
    expect(phara.status).toBe("zu_teuer");
    expect(phara.targetOpt).toBeCloseTo(182.205, 2);
    const tiefstapler = buildMarketComparisonRow(article({ currentVk: 4.49 }), quote({ priceAvg7: 27.67 }), DEFAULT_COST_SETTINGS, null);
    expect(tiefstapler.status).toBe("zu_guenstig");
  });

  it("die Untergrenze 4,99 € zaehlt als im Rahmen (Billigkarten sind Warenkorb-Fueller)", () => {
    const row = buildMarketComparisonRow(article({ currentVk: 4.99 }), quote({ priceAvg7: 0.3 }), DEFAULT_COST_SETTINGS, null);
    expect(row.targetMin).toBeCloseTo(4.99);
    expect(row.targetOpt).toBeCloseTo(4.99);
    expect(row.status).toBe("im_korridor");
  });

  it("Pack-Artikel: Preis je Karte x Pack-Menge, Pack-Versand und -Verpackung", () => {
    // Markt 3 x 0,50 = 1,50; HK = 1,50 + 0,575 + 0,50 + 0,062 = 2,637 -> 25 %: 2,987 / 0,512 = 5,834
    const row = buildMarketComparisonRow(article({ packQty: 3, currentVk: 5.99 }), quote({ priceAvg7: 0.5 }), DEFAULT_COST_SETTINGS, null);
    expect(row.marketValue).toBeCloseTo(1.5);
    expect(row.targetMin).toBeCloseTo(5.834, 2);
  });

  it("Marktwert = 7-Tage-Schnitt, sonst 30-Tage-Schnitt, sonst Trend", () => {
    const v = (q: Partial<LatestQuote>) => buildMarketComparisonRow(article({ currentVk: 8 }), quote(q), DEFAULT_COST_SETTINGS, null).marketValue;
    expect(v({ priceAvg7: 2, priceAvg30: 3, priceTrend: 4 })).toBe(2);
    expect(v({ priceAvg30: 3, priceTrend: 4 })).toBe(3);
    expect(v({ priceTrend: 4 })).toBe(4);
  });

  it("Marge des heutigen VK bei Nachkauf zum Marktwert (Deckungsbeitrag, vor Fixkosten)", () => {
    // VK 8,00, Gebuehren 0,35 + 8 x (0,11 + 0,10) x 1,19 = 2,349, HK 3,298 -> (8 - 2,349 - 3,298) / 8 = 0,294
    const row = buildMarketComparisonRow(article({ currentVk: 8 }), quote({ priceAvg7: 2 }), DEFAULT_COST_SETTINGS, null);
    expect(row.marginAtMarket).toBeCloseTo(0.294, 3);
  });

  it("rechnet Pack-Artikel mit Trend x Pack-Menge", () => {
    const row = buildMarketComparisonRow(article({ packQty: 3, currentVk: 5.99 }), quote({ priceTrend: 0.5 }), DEFAULT_COST_SETTINGS, null);
    expect(row.marketValue).toBeCloseTo(1.5);
  });

  it("mehrdeutig: Spanne statt Wert, Ampel nur bei klarer Lage", () => {
    const q = quote({ matchQuality: "mehrdeutig", priceMin: 0.3, priceMax: 30, variants: 3 });
    const row = buildMarketComparisonRow(article({ currentVk: 6.99 }), q, DEFAULT_COST_SETTINGS, null);
    expect(row.marketValue).toBeNull();
    expect(row.marketRange).toEqual({ min: 0.3, max: 30, variants: 3 });
    // 6,99 € liegt zwischen den Zielspannen der Varianten (ab 4,99 .. ueber 38 €): kein Urteil.
    expect(row.status).toBe("im_korridor");
    // Selbst gegen die billigste Variante (Markt 4 € -> Ziel-Min ~11,03 €) zu billig: eindeutig zu guenstig.
    const billig = buildMarketComparisonRow(
      article({ currentVk: 4.99 }),
      quote({ matchQuality: "mehrdeutig", priceMin: 4, priceMax: 30, variants: 2 }),
      DEFAULT_COST_SETTINGS,
      null
    );
    expect(billig.status).toBe("zu_guenstig");
  });

  it("markiert einen EK deutlich ueber Marktwert", () => {
    const a = article({ currentVk: 9.99, currentEk: 3 });
    expect(buildMarketComparisonRow(a, quote({ priceAvg7: 1 }), DEFAULT_COST_SETTINGS, null).ekAboveMarket).toBe(true);
    expect(buildMarketComparisonRow(a, quote({ priceAvg7: 2.5 }), DEFAULT_COST_SETTINGS, null).ekAboveMarket).toBe(false);
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

  it("Shop-Volumen geht ueber das Einschreiben in die Spanne ein, Fixkosten nicht (Deckungsbeitrag)", () => {
    const a = article({
      currentVk: 9.99,
      windows: {
        "365": { qty: 5, revenue: 50, ek: 10, ebayFeeTotal: 0, shippingCost: 0, dbI: 40, dbII: 30, fixedCostShare: 0, avgPrice: 10, rank: null },
      },
    });
    const shop = { units365d: 3400, unitsAtOrAboveThreshold: 60 };
    const ohne = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, null);
    const mit = buildMarketComparisonRow(a, quote(), DEFAULT_COST_SETTINGS, shop);
    const einschreiben = registeredRateBelowThreshold(shop, DEFAULT_COST_SETTINGS); // VK-MIN liegt unter der Schwelle
    // VK-MIN = (0,35 + HK ohne Fixkosten) / (1 - (0,11 + 0,09) x 1,19 - 0,25) = ... / 0,512
    expect(mit.corridor.min - ohne.corridor.min).toBeCloseTo(einschreiben / 0.512, 5);
    // Fixkosten (4.229 € -> hier verdoppelt) aendern die Spanne nicht.
    const teurerShop = { ...DEFAULT_COST_SETTINGS, fixedYearlyOther: DEFAULT_COST_SETTINGS.fixedYearlyOther * 2 };
    expect(buildMarketComparisonRow(a, quote(), teurerShop, shop).corridor.min).toBeCloseTo(mit.corridor.min, 8);
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
