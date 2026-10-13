import { describe, expect, it } from "vitest";
import { DEFAULT_COST_SETTINGS } from "./costSettings";
import {
  buyShippingShare,
  classifyPriceStatus,
  computeEbayFees,
  computeHk,
  computeMargin,
  computePriceCorridor,
  computeShopVolume,
  contributionMarginAt,
  fixedCostPerUnit,
  fullCostMarginAt,
  registeredCostPerUnit,
  registeredRateBelowThreshold,
  totalFixedYearly,
  type HkInput,
  type ShopVolume,
} from "./costEngine";

const S = DEFAULT_COST_SETTINGS;

/** Chris' bestaetigte Betriebszahlen: ca. 3.400 Stueck/Jahr, davon (Annahme) 60 mit VK >= 30 EUR. */
const SHOP: ShopVolume = { units365d: 3400, unitsAtOrAboveThreshold: 60 };

/** Pflichtfelder der Eingabe, neutral (kein Shop, VK unbekannt). */
const NEUTRAL = { fixedCostPerUnit: 0, vk: null, shop: null } satisfies Pick<HkInput, "fixedCostPerUnit" | "vk" | "shop">;

describe("Defaults = Chris' bestaetigte Echtzahlen", () => {
  it("Fixkosten stehen als JAHRESwerte (Monatspreise x 12), nicht als Monatspreise", () => {
    expect(S.fixedYearlyEbayShop).toBe(95 * 12);
    expect(S.fixedYearlyBillbee).toBe(70 * 12);
    expect(S.fixedYearlyLexoffice).toBe(30 * 12);
    expect(S.fixedYearlyPackagingLicense).toBe(50);
    // Sammelfeld = Telekom 540 + AfA 199 + Beitraege 141 + Steuerberatung 16 + Zinsen 24 + Raumkosten 919
    expect(S.fixedYearlyOther).toBe(540 + 199 + 141 + 16 + 24 + 919);
  });

  it("Einkaufs-Versand wird zu 50 % einkalkuliert, Einschreiben ab 30 EUR mit 2,35 EUR und 100 Marken/Jahr", () => {
    expect(S.buyShippingShareFactor).toBe(0.5);
    expect(S.registeredCostPerShipment).toBe(2.35);
    expect(S.registeredThreshold).toBe(30);
    expect(S.registeredStampsPerYear).toBe(100);
  });
});

describe("buyShippingShare (Bestellporto x Anteil)", () => {
  it("nimmt 1,15 EUR x 50 % fuer Einzelkaeufe unter 5 Stueck", () => {
    expect(buyShippingShare({ ek: 1, kind: "single", purchaseQty: 3, ...NEUTRAL }, S)).toBeCloseTo(1.15 * 0.5);
  });

  it("nimmt 1,30 EUR x 50 % fuer Einzelkaeufe ab 5 Stueck (Staffel bleibt als Rechnungswert erhalten)", () => {
    expect(buyShippingShare({ ek: 1, kind: "single", purchaseQty: 5, ...NEUTRAL }, S)).toBeCloseTo(1.3 * 0.5);
  });

  it("zaehlt Einkaufs-Versand fuer Packs nur EINMALIG (3er-Pack gilt als 1 Einheit)", () => {
    expect(buyShippingShare({ ek: 1, kind: "pack", packSize: 3, ...NEUTRAL }, S)).toBeCloseTo(1.15 * 0.5);
  });

  it("folgt dem Faktor: 100 % ergibt das volle Porto, 0 % nichts", () => {
    // Regression: vorher wurde das volle Bestellporto je verkaufter Einheit angesetzt.
    const input: HkInput = { ek: 1, kind: "single", purchaseQty: 3, ...NEUTRAL };
    expect(buyShippingShare(input, { ...S, buyShippingShareFactor: 1 })).toBeCloseTo(1.15);
    expect(buyShippingShare(input, { ...S, buyShippingShareFactor: 0 })).toBe(0);
  });
});

describe("fixedCostPerUnit (shopweit)", () => {
  it("summiert ALLE Fixkostenfelder (Abos + Verpackungslizenz + Sonstige) zu 4.229 EUR/Jahr", () => {
    expect(totalFixedYearly(S)).toBe(1140 + 840 + 360 + 50 + 1839);
    expect(totalFixedYearly(S)).toBe(4229);
  });

  it("teilt die Jahresfixkosten durch die SHOPWEITE verkaufte Stueckzahl/365T", () => {
    expect(fixedCostPerUnit(4229, S)).toBeCloseTo(1.0);
    expect(fixedCostPerUnit(2 * 4229, S)).toBeCloseTo(0.5);
    // Chris' Betriebszahl: ca. 3.400 Stueck -> ca. 1,24 EUR je Stueck (Abos allein: 2.390/3.400 = 0,70).
    expect(fixedCostPerUnit(3400, S)).toBeCloseTo(4229 / 3400, 5);
  });

  it("nimmt Verpackungslizenz und Sonstige mit auf (Regression: vierte Zeile fehlte)", () => {
    const nurAbos = { ...S, fixedYearlyPackagingLicense: 0, fixedYearlyOther: 0 };
    expect(fixedCostPerUnit(1000, S) - fixedCostPerUnit(1000, nurAbos)).toBeCloseTo((50 + 1839) / 1000, 6);
  });

  it("gibt 0 zurueck ohne verkaufte Stueck (Division durch 0 vermeiden)", () => {
    expect(fixedCostPerUnit(0, S)).toBe(0);
  });
});

describe("Einschreiben: Schwellenlogik", () => {
  it("r = max(0, S - N_T) x C / (N - N_T) fuer VK unter der Schwelle", () => {
    const r = registeredRateBelowThreshold(SHOP, S);
    expect(r).toBeCloseTo(((100 - 60) * 2.35) / (3400 - 60), 8);
    expect(registeredCostPerUnit(4.99, SHOP, S)).toBeCloseTo(r, 8);
  });

  it("eine Karte ab 30 EUR traegt die vollen 2,35 EUR (Schwelle inklusive)", () => {
    expect(registeredCostPerUnit(35, SHOP, S)).toBe(2.35);
    expect(registeredCostPerUnit(30, SHOP, S)).toBe(2.35);
    expect(registeredCostPerUnit(29.99, SHOP, S)).toBeLessThan(0.1);
  });

  it("die Marken werden vollstaendig verteilt: N_T x C + (N - N_T) x r = Marken x C", () => {
    const r = registeredRateBelowThreshold(SHOP, S);
    expect(60 * 2.35 + (3400 - 60) * r).toBeCloseTo(100 * 2.35, 6);
  });

  it("verbrauchen die Karten ab Schwelle schon alle Marken, bleibt unter der Schwelle 0", () => {
    expect(registeredRateBelowThreshold({ units365d: 3400, unitsAtOrAboveThreshold: 150 }, S)).toBe(0);
  });

  it("faellt ohne N_T auf den flachen Satz S x C / N zurueck", () => {
    const flat = (100 * 2.35) / 3400;
    expect(registeredRateBelowThreshold({ units365d: 3400, unitsAtOrAboveThreshold: null }, S)).toBeCloseTo(flat, 8);
    expect(registeredCostPerUnit(4.99, { units365d: 3400, unitsAtOrAboveThreshold: null }, S)).toBeCloseTo(flat, 8);
    // VK unbekannt -> ebenfalls der flache Durchschnitt
    expect(registeredCostPerUnit(null, SHOP, S)).toBeCloseTo(flat, 8);
  });

  it("ohne Shop-Daten gibt es unter der Schwelle nichts umzulegen, ab Schwelle gilt trotzdem 2,35", () => {
    expect(registeredCostPerUnit(4.99, null, S)).toBe(0);
    expect(registeredCostPerUnit(35, null, S)).toBe(2.35);
  });

  it("computeShopVolume zaehlt N und N_T aus Stueckzahl und Ø-VK", () => {
    const v = computeShopVolume(
      [
        { qty: 10, avgPrice: 5 },
        { qty: 2, avgPrice: 30 },
        { qty: 1, avgPrice: 45 },
        { qty: 0, avgPrice: 99 },
      ],
      S
    );
    expect(v).toEqual({ units365d: 13, unitsAtOrAboveThreshold: 3 });
  });
});

describe("computeHk", () => {
  it("baut die Selbstkosten HK fuer eine Einzelkarte unter der Schwelle auf", () => {
    const shopFixed = fixedCostPerUnit(3400, S);
    const hk = computeHk(
      { ek: 3.4, kind: "single", purchaseQty: 3, fixedCostPerUnit: shopFixed, vk: 4.99, shop: SHOP },
      S
    );
    const r = registeredRateBelowThreshold(SHOP, S);
    // 3.40 + 0.575 (Einkaufs-Versand 1,15 x 50 %) + 0.67 (Versand) + r (Einschreiben) + 0.053 + Fixkosten
    expect(hk.total).toBeCloseTo(3.4 + 0.575 + 0.67 + r + 0.053 + shopFixed, 5);
    expect(hk.registeredMail).toBeCloseTo(r, 8);
  });

  it("belastet eine 35-EUR-Karte mit dem vollen Einschreiben, eine 4,99er nicht (je Artikel, nicht pauschal)", () => {
    const base = { ek: 10, kind: "single" as const, purchaseQty: 3, fixedCostPerUnit: 0, shop: SHOP };
    const teuer = computeHk({ ...base, vk: 35 }, S);
    const guenstig = computeHk({ ...base, vk: 4.99 }, S);
    expect(teuer.registeredMail).toBe(2.35);
    expect(guenstig.registeredMail).toBeLessThan(0.1);
    // Regression: die alte Pauschale lieferte fuer beide dieselben 0,15.
    expect(teuer.registeredMail).not.toBeCloseTo(0.15, 2);
    expect(guenstig.registeredMail).not.toBeCloseTo(0.15, 2);
  });

  it("baut die Selbstkosten HK fuer einen 3er-Pack auf (Pack = eine Versandeinheit)", () => {
    const shopFixed = fixedCostPerUnit(4229 * 2, S); // 0.5 EUR/Stk, shopweit
    const hk = computeHk(
      { ek: 1.77, kind: "pack", packSize: 3, fixedCostPerUnit: shopFixed, vk: 4.5, shop: SHOP },
      S
    );
    const r = registeredRateBelowThreshold(SHOP, S);
    expect(hk.total).toBeCloseTo(1.77 + 1.15 * 0.5 + 0.5 + r + 0.062 + 0.5, 5);
  });

  it("belastet einen Nischen-Artikel mit wenigen eigenen Verkaeufen NICHT mit der vollen Shop-Fixkostenlast", () => {
    // Fixkosten duerfen nicht durch die eigene (kleine) Artikel-Stueckzahl geteilt werden, sondern durch die shopweite.
    const shopFixed = fixedCostPerUnit(3400, S);
    const nicheArticleSoldOnce = computeHk(
      { ek: 3.4, kind: "single", purchaseQty: 1, fixedCostPerUnit: shopFixed, vk: 6, shop: SHOP },
      S
    );
    expect(nicheArticleSoldOnce.fixedCostShare).toBeLessThan(1.3);
  });
});

describe("computeEbayFees (unveraendert: 0,35 + 11 % + 9 %, je x1,19)", () => {
  it("berechnet Provision = 0,35 + VK x 11% x 1,19", () => {
    const fees = computeEbayFees(20, 0.09, S);
    expect(fees.commission).toBeCloseTo(0.35 + 20 * 0.11 * 1.19, 5);
  });

  it("berechnet die Anzeigen-Gebuehr = VK x Ad-Rate x 1,19", () => {
    const fees = computeEbayFees(20, 0.1, S);
    expect(fees.adFee).toBeCloseTo(20 * 0.1 * 1.19, 5);
  });
});

describe("computeMargin", () => {
  it("Gewinn = VK - VK-Kosten - HK, Gewinnmarge = Gewinn / VK", () => {
    const vk = 10;
    const hk = 4;
    const result = computeMargin(vk, hk, 0.09, S);
    const expectedFees = computeEbayFees(vk, 0.09, S).total;
    expect(result.profit).toBeCloseTo(vk - expectedFees - hk, 5);
    expect(result.marginPct).toBeCloseTo(result.profit / vk, 5);
  });
});

function corridorFor(ek: number, vk: number, shop: ShopVolume | null = SHOP) {
  const hk = computeHk(
    { ek, kind: "single", fixedCostPerUnit: fixedCostPerUnit(shop?.units365d ?? 0, S), vk, shop },
    S
  );
  return { hk, corridor: computePriceCorridor(hk, vk, S) };
}

describe("computePriceCorridor: Vollkosten-Korridor", () => {
  it("VK-MIN/VK-GUT sind (HK + VK-Kosten) x 1,33 / x 1,66", () => {
    const { hk, corridor } = corridorFor(2.5, 10);
    const basis = hk.total + corridor.currentVkFees.total;
    expect(corridor.vkMin).toBeCloseTo(basis * 1.33, 5);
    expect(corridor.vkGood).toBeCloseTo(basis * 1.66, 5);
    expect(corridor.vkGood).toBeGreaterThan(corridor.vkMin);
  });

  it("enthaelt die Fixkosten: derselbe Artikel ohne Fixkosten hat ein niedrigeres MIN", () => {
    // Regression: Aufrufer uebergaben fixedCostPerUnit: 0 -> Korridor ohne Fixkosten.
    const mit = corridorFor(2.5, 10).corridor;
    const ohne = (() => {
      const hk = computeHk({ ek: 2.5, kind: "single", fixedCostPerUnit: 0, vk: 10, shop: SHOP }, S);
      return computePriceCorridor(hk, 10, S);
    })();
    expect(mit.vkMin - ohne.vkMin).toBeCloseTo((4229 / 3400) * 1.33, 5);
  });
});

describe("Deckungsbeitrags-Grenze", () => {
  it("liegt unter dem Vollkosten-MIN und genau dort, wo der Gewinn VOR Fixkosten 0 ist", () => {
    const { corridor } = corridorFor(2.5, 10);
    expect(corridor.vkContribution).toBeLessThan(corridor.vkMin);
    const atLine = computeMargin(corridor.vkContribution, corridor.hkContribution, S.adFeeRateGood, S);
    expect(atLine.profit).toBeCloseTo(0, 6);
  });

  it("hkContribution ist HK minus Fixkostenanteil", () => {
    const { hk, corridor } = corridorFor(2.5, 10);
    expect(corridor.hkContribution).toBeCloseTo(hk.total - hk.fixedCostShare, 8);
  });

  it("Vollkosten-Marge liegt um den Fixkostenanteil/VK unter der Marge vor Fixkosten", () => {
    const { hk, corridor } = corridorFor(2.5, 10);
    expect(contributionMarginAt(10, corridor) - fullCostMarginAt(10, corridor)).toBeCloseTo(hk.fixedCostShare / 10, 8);
  });
});

describe("classifyPriceStatus", () => {
  it("klassifiziert VK im Korridor / ueber GUT korrekt", () => {
    const { corridor } = corridorFor(2.5, 10);
    expect(classifyPriceStatus((corridor.vkMin + corridor.vkGood) / 2, corridor)).toBe("im_korridor");
    expect(classifyPriceStatus(corridor.vkGood + 1, corridor)).toBe("ueber_gut");
  });

  it("klassifiziert VK unter MIN bei erreichbarem Ziel als 'zu guenstig' (unter_min)", () => {
    // EK 2,50 / VK 10: Marge vor Fixkosten liegt klar ueber dem 25-%-Ziel -> Ziel bei diesem VK erreichbar.
    const { corridor } = corridorFor(2.5, 10);
    const vk = corridor.vkMin - 0.5;
    expect(contributionMarginAt(vk, corridor)).toBeGreaterThanOrEqual(corridor.targetMargin);
    expect(classifyPriceStatus(vk, corridor)).toBe("unter_min");
  });

  it("EK 0,90 / VK 4,99: 25 % Vollkosten-Marge sind unmoeglich -> 'ziel_unerreichbar', nicht 'unter_min'", () => {
    const { corridor } = corridorFor(0.9, 4.99);
    // Selbst mit null Fixkosten liegt die Obergrenze unter dem Ziel (24,8 %) ...
    expect(contributionMarginAt(4.99, corridor)).toBeLessThan(corridor.targetMargin);
    expect(contributionMarginAt(4.99, corridor)).toBeLessThan(0.25);
    // ... der Verkauf deckt aber noch seine variablen Kosten (kein echter Verlust) ...
    expect(4.99).toBeGreaterThan(corridor.vkContribution);
    // ... und liegt unter dem Vollkosten-MIN (das war heute dauerhaft "unter MIN").
    expect(4.99).toBeLessThan(corridor.vkMin);
    expect(classifyPriceStatus(4.99, corridor)).toBe("ziel_unerreichbar");
  });

  it("bleibt 'unter_min', sobald der Verkauf unter der Deckungsbeitrags-Grenze liegt (echter Verlust)", () => {
    const { corridor } = corridorFor(0.9, 4.99);
    const verlustVk = corridor.vkContribution - 0.3;
    expect(classifyPriceStatus(verlustVk, corridor)).toBe("unter_min");
  });

  it("zwischen Ziel-Linie und Vollkosten-MIN frisst nur die Fixkostenumlage das Ziel -> unter_min", () => {
    const { corridor } = corridorFor(0.9, 4.99);
    // VK, ab dem das Ziel VOR Fixkosten erreichbar ist: (HK ohne Fixkosten + 0,35) / (1 - Gebuehrensatz - Ziel)
    const vkZielVorFixkosten = (corridor.hkContribution + corridor.feeFixed) / (1 - corridor.feeRate - corridor.targetMargin);
    const vk = (vkZielVorFixkosten + corridor.vkMin) / 2;
    expect(vk).toBeLessThan(corridor.vkMin);
    expect(classifyPriceStatus(vk, corridor)).toBe("unter_min");
  });
});
