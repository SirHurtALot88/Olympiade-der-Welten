import { describe, expect, it } from "vitest";
import { DEFAULT_COST_SETTINGS } from "./costSettings";
import {
  buyShippingShare,
  classifyPriceStatus,
  computeEbayFees,
  computeHk,
  computeMargin,
  computePriceCorridor,
  fixedCostPerUnit,
} from "./costEngine";

describe("buyShippingShare", () => {
  it("nimmt 1,15 EUR fuer Einzelkaeufe unter 5 Stueck", () => {
    expect(
      buyShippingShare({ ek: 1, kind: "single", purchaseQty: 3, fixedCostPerUnit: 0 }, DEFAULT_COST_SETTINGS)
    ).toBeCloseTo(1.15);
  });

  it("nimmt 1,30 EUR fuer Einzelkaeufe ab 5 Stueck", () => {
    expect(
      buyShippingShare({ ek: 1, kind: "single", purchaseQty: 5, fixedCostPerUnit: 0 }, DEFAULT_COST_SETTINGS)
    ).toBeCloseTo(1.3);
  });

  it("multipliziert 1,30 EUR mit der Packgroesse fuer Packs", () => {
    expect(
      buyShippingShare({ ek: 1, kind: "pack", packSize: 3, fixedCostPerUnit: 0 }, DEFAULT_COST_SETTINGS)
    ).toBeCloseTo(3.9);
  });
});

describe("fixedCostPerUnit (shopweit)", () => {
  it("teilt die Jahresfixkosten (95+25+60=180) durch die SHOPWEITE verkaufte Stueckzahl/365T", () => {
    expect(fixedCostPerUnit(180, DEFAULT_COST_SETTINGS)).toBeCloseTo(1.0);
    expect(fixedCostPerUnit(360, DEFAULT_COST_SETTINGS)).toBeCloseTo(0.5);
  });

  it("gibt 0 zurueck ohne verkaufte Stueck (Division durch 0 vermeiden)", () => {
    expect(fixedCostPerUnit(0, DEFAULT_COST_SETTINGS)).toBe(0);
  });
});

describe("computeHk", () => {
  it("baut die Selbstkosten HK fuer eine Einzelkarte auf (KONZEPT §7.3)", () => {
    const shopFixed = fixedCostPerUnit(180, DEFAULT_COST_SETTINGS); // 1.0 EUR/Stk, shopweit
    const hk = computeHk(
      { ek: 3.4, kind: "single", purchaseQty: 3, fixedCostPerUnit: shopFixed },
      DEFAULT_COST_SETTINGS
    );
    // 3.40 + 1.15 (buyShip <5) + 0.67 (Versand) + 0.15 (Prio) + 0.053 (Verpackung) + 1.0 (shopweite Fixkosten/Stk)
    expect(hk.total).toBeCloseTo(3.4 + 1.15 + 0.67 + 0.15 + 0.053 + 1.0, 5);
  });

  it("baut die Selbstkosten HK fuer einen 3er-Pack auf", () => {
    const shopFixed = fixedCostPerUnit(360, DEFAULT_COST_SETTINGS); // 0.5 EUR/Stk, shopweit
    const hk = computeHk(
      { ek: 1.77, kind: "pack", packSize: 3, fixedCostPerUnit: shopFixed },
      DEFAULT_COST_SETTINGS
    );
    // 1.77 + 3.90 (1.30x3) + 0.50 + 0.1875 + 0.062 + 0.5 (shopweite Fixkosten/Stk)
    expect(hk.total).toBeCloseTo(1.77 + 3.9 + 0.5 + 0.1875 + 0.062 + 0.5, 5);
  });

  it("belastet einen Nischen-Artikel mit wenigen eigenen Verkaeufen NICHT mit der vollen Shop-Fixkostenlast", () => {
    // Regressionstest fuer den Bug: Fixkosten duerfen nicht durch die eigene
    // (kleine) Artikel-Stueckzahl geteilt werden, sondern durch die shopweite.
    const shopFixed = fixedCostPerUnit(3000, DEFAULT_COST_SETTINGS); // grosser Shop, viele verkaufte Stueck/Jahr
    const nicheArticleSoldOnce = computeHk(
      { ek: 3.4, kind: "single", purchaseQty: 1, fixedCostPerUnit: shopFixed },
      DEFAULT_COST_SETTINGS
    );
    expect(nicheArticleSoldOnce.fixedCostShare).toBeLessThan(1);
  });
});

describe("computeEbayFees", () => {
  it("berechnet Provision = 0,35 + VK x 11% x 1,19", () => {
    const fees = computeEbayFees(20, 0.09, DEFAULT_COST_SETTINGS);
    expect(fees.commission).toBeCloseTo(0.35 + 20 * 0.11 * 1.19, 5);
  });

  it("berechnet die Anzeigen-Gebuehr = VK x Ad-Rate x 1,19", () => {
    const fees = computeEbayFees(20, 0.1, DEFAULT_COST_SETTINGS);
    expect(fees.adFee).toBeCloseTo(20 * 0.1 * 1.19, 5);
  });
});

describe("computeMargin", () => {
  it("Gewinn = VK - VK-Kosten - HK, Gewinnmarge = Gewinn / VK", () => {
    const vk = 10;
    const hk = 4;
    const result = computeMargin(vk, hk, 0.09, DEFAULT_COST_SETTINGS);
    const expectedFees = computeEbayFees(vk, 0.09, DEFAULT_COST_SETTINGS).total;
    expect(result.profit).toBeCloseTo(vk - expectedFees - hk, 5);
    expect(result.marginPct).toBeCloseTo(result.profit / vk, 5);
  });
});

describe("computePriceCorridor + classifyPriceStatus", () => {
  it("VK-MIN/VK-GUT sind (HK + VK-Kosten) x 1,33 / x 1,66", () => {
    const hk = 4;
    const currentVk = 10;
    const corridor = computePriceCorridor(hk, currentVk, DEFAULT_COST_SETTINGS);
    const basis = hk + corridor.currentVkFees.total;
    expect(corridor.vkMin).toBeCloseTo(basis * 1.33, 5);
    expect(corridor.vkGood).toBeCloseTo(basis * 1.66, 5);
    expect(corridor.vkGood).toBeGreaterThan(corridor.vkMin);
  });

  it("klassifiziert VK unter MIN als 'zu guenstig' (unter_min)", () => {
    const corridor = computePriceCorridor(4, 10, DEFAULT_COST_SETTINGS);
    expect(classifyPriceStatus(corridor.vkMin - 0.5, corridor)).toBe("unter_min");
  });

  it("klassifiziert VK im Korridor korrekt", () => {
    const corridor = computePriceCorridor(4, 10, DEFAULT_COST_SETTINGS);
    const mid = (corridor.vkMin + corridor.vkGood) / 2;
    expect(classifyPriceStatus(mid, corridor)).toBe("im_korridor");
  });

  it("klassifiziert VK ueber GUT als 'zu teuer' (ueber_gut)", () => {
    const corridor = computePriceCorridor(4, 10, DEFAULT_COST_SETTINGS);
    expect(classifyPriceStatus(corridor.vkGood + 1, corridor)).toBe("ueber_gut");
  });
});
