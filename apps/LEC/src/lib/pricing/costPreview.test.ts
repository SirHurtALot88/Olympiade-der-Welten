import { describe, expect, it } from "vitest";
import { DEFAULT_COST_SETTINGS } from "./costSettings";
import { PREVIEW_EXAMPLES, buildCostPreview, deriveCostFacts } from "./costPreview";
import { buildSortimentRow, shopVolumeFromAggregates, type ArticleAggregate } from "../dashboard/viewModel";

const S = DEFAULT_COST_SETTINGS;
const SHOP = { units365d: 3400, unitsAtOrAboveThreshold: 60 };

describe("Einstellungen-Vorschau", () => {
  it("zeigt den Sprung beim Einschreiben: unter der Schwelle ~0,03 EUR, darueber 2,35 EUR", () => {
    const [guenstig, teuer] = PREVIEW_EXAMPLES.map((ex) => buildCostPreview(ex, S, SHOP));
    expect(guenstig.example.vk).toBeLessThan(S.registeredThreshold);
    expect(teuer.example.vk).toBeGreaterThanOrEqual(S.registeredThreshold);
    expect(guenstig.hk.registeredMail).toBeLessThan(0.1);
    expect(teuer.hk.registeredMail).toBe(2.35);
  });

  it("wirkt der Einkaufs-Versand-Faktor in der Vorschau", () => {
    const ex = PREVIEW_EXAMPLES[0];
    const half = buildCostPreview(ex, S, SHOP);
    const full = buildCostPreview(ex, { ...S, buyShippingShareFactor: 1 }, SHOP);
    expect(half.hk.buyShipping).toBeCloseTo(0.575, 8);
    expect(full.hk.buyShipping).toBeCloseTo(1.15, 8);
  });

  it("enthaelt shopweite Fixkosten (nicht 0) und beide Korridor-Linien", () => {
    const pv = buildCostPreview(PREVIEW_EXAMPLES[0], S, SHOP);
    expect(pv.hk.fixedCostShare).toBeCloseTo(4229 / 3400, 8);
    expect(pv.corridor.vkContribution).toBeLessThan(pv.corridor.vkMin);
    expect(pv.hkContribution).toBeCloseTo(pv.hk.total - pv.hk.fixedCostShare, 8);
  });

  it("widerspricht dem Sortiment nicht: gleiche Zahlen wie buildSortimentRow fuer denselben Artikel", () => {
    for (const ex of PREVIEW_EXAMPLES) {
      const article: ArticleAggregate = {
        articleId: ex.label,
        nameRaw: ex.label,
        setCode: null,
        packQty: 1,
        stock: 0,
        active: true,
        currentVk: ex.vk,
        currentEk: null,
        latestMarketTrend: null,
        windows: {
          "365": { qty: 3400, revenue: 3400 * ex.vk, ek: 3400 * ex.ek, ebayFeeTotal: 0, shippingCost: 0, dbI: 0, dbII: 0, avgPrice: ex.vk, rank: null },
        },
      };
      // Gleiche Shop-Menge wie in der Vorschau erzwingen (N = 3.400, N_T je nach Beispiel).
      const shop = shopVolumeFromAggregates([article], S)!;
      const row = buildSortimentRow(article, "beobachten", S, shop);
      const pv = buildCostPreview(ex, S, shop);
      expect(row.corridor.min).toBeCloseTo(pv.corridor.vkMin, 8);
      expect(row.corridor.good).toBeCloseTo(pv.corridor.vkGood, 8);
      expect(row.corridor.contribution).toBeCloseTo(pv.corridor.vkContribution, 8);
      expect(row.priceStatus).toBe(pv.status);
    }
  });

  it("leitet die Gegenrechen-Werte ab: 4.229 EUR/Jahr = 352,42 EUR/Monat, 1,24 EUR je Stueck bei 3.400 Stueck", () => {
    const f = deriveCostFacts(S, SHOP);
    expect(f.fixedYearlyTotal).toBe(4229);
    expect(f.fixedMonthlyTotal).toBeCloseTo(4229 / 12, 8);
    expect(f.fixedPerUnit).toBeCloseTo(4229 / 3400, 8);
    expect(f.registeredYearlyCost).toBeCloseTo(235, 8);
    expect(f.buyShippingEffectiveUnderFive).toBeCloseTo(0.575, 8);
  });

  it("zeigt ohne Import keine erfundene Stueckzahl", () => {
    const f = deriveCostFacts(S, null);
    expect(f.shopUnits).toBeNull();
    expect(f.fixedPerUnit).toBeNull();
    expect(f.fixedYearlyTotal).toBe(4229);
  });
});
