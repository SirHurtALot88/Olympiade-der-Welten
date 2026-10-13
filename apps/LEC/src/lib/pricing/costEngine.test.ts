import { describe, expect, it } from "vitest";
import { DEFAULT_COST_SETTINGS } from "./costSettings";
import {
  buyShippingShare,
  classifyPriceStatus,
  computeEbayFees,
  computeHk,
  computeMargin,
  contributionMarginForPrice,
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
  return { hk, corridor: computePriceCorridor(hk, vk, S, { kind: "single", shop }) };
}

// Handrechnung (unabhaengig vom Code), Einzelkarte, EK 2,50, Shop 3.400 Stk/Jahr, 60 davon ab 30 €:
//   Einschreiben unter der Schwelle r = (100 - 60) x 2,35 / (3.400 - 60) = 0,02814
//   HK ohne Fixkosten = 2,50 + 0,575 (Einkaufs-Versand 1,15 x 50 %) + 0,67 + 0,053 + 0,02814 = 3,82614
//   VK-MIN (25 %, Anzeigen 9 %):  (0,35 + 3,82614) / (1 - 0,11 x 1,19 - 0,09 x 1,19 - 0,25) = 8,1565
//   VK-GUT (33 %, Anzeigen 10 %): (0,35 + 3,82614) / (1 - 0,11 x 1,19 - 0,10 x 1,19 - 0,33) = 9,9408
describe("computePriceCorridor: Zielspanne 25 % bis 33 % Deckungsbeitrag", () => {
  it("VK-MIN / VK-GUT = VK fuer 25 % / 33 % Marge vor Fixkosten (handgerechnet)", () => {
    const { corridor } = corridorFor(2.5, 10);
    expect(corridor.vkMin).toBeCloseTo(8.1565, 3);
    expect(corridor.vkGood).toBeCloseTo(9.9408, 3);
    expect(corridor.targetMargin).toBe(0.25);
  });

  it("die Marge an den Grenzen ist exakt 25 % bzw. 33 % (Gebuehren am Zielpreis, nicht am heutigen VK)", () => {
    const { corridor } = corridorFor(2.5, 10);
    const input = { ek: 2.5, kind: "single" as const, shop: SHOP };
    expect(contributionMarginForPrice(corridor.vkMin, input, S.adFeeRateMin, S)).toBeCloseTo(0.25, 6);
    expect(contributionMarginForPrice(corridor.vkGood, input, S.adFeeRateGood, S)).toBeCloseTo(0.33, 6);
  });

  it("haengt NICHT vom heutigen VK ab (frueher: Gebuehren zum aktuellen VK, ein zu niedriger Preis senkte sein eigenes MIN)", () => {
    expect(corridorFor(2.5, 3).corridor.vkMin).toBeCloseTo(corridorFor(2.5, 30).corridor.vkMin, 6);
  });

  it("enthaelt keine Fixkosten (Deckungsbeitrag): mit und ohne Fixkostenanteil dieselbe Spanne", () => {
    const hk = computeHk({ ek: 2.5, kind: "single", fixedCostPerUnit: 0, vk: 10, shop: SHOP }, S);
    const ohne = computePriceCorridor(hk, 10, S, { kind: "single", shop: SHOP });
    expect(ohne.vkMin).toBeCloseTo(corridorFor(2.5, 10).corridor.vkMin, 8);
  });

  it("Untergrenze 4,99 €: bei sehr niedrigem EK ist die Spanne die Untergrenze (Warenkorb-Fueller)", () => {
    const { corridor } = corridorFor(0.2, 4.99);
    expect(corridor.vkMin).toBe(4.99);
    expect(corridor.vkGood).toBe(4.99);
  });

  it("Einschreiben: ab Zielpreis 30 € traegt der Preis die vollen 2,35 € (iteriert bis konsistent)", () => {
    // EK 20: HK = 20 + 0,575 + 0,67 + 0,053 + 2,35 = 23,648 -> VK-MIN = (0,35 + 23,648) / 0,512 = 46,87
    const { corridor } = corridorFor(20, 50);
    expect(corridor.vkMin).toBeCloseTo(46.871, 2);
  });

  it("Pack: eigener Versand/Verpackung, Einkaufs-Versand nur einmal", () => {
    const hk = computeHk({ ek: 1.5, kind: "pack", packSize: 3, fixedCostPerUnit: 0, vk: null, shop: null }, S);
    const c = computePriceCorridor(hk, 5.99, S, { kind: "pack", packSize: 3, shop: null });
    // HK = 1,50 + 0,575 + 0,50 + 0,062 = 2,637 -> (0,35 + 2,637) / 0,512 = 5,834
    expect(c.vkMin).toBeCloseTo(5.834, 2);
  });
});

describe("Deckungsbeitrags-Grenze", () => {
  it("liegt unter VK-MIN und genau dort, wo der Gewinn VOR Fixkosten 0 ist", () => {
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
  it("in der Spanne = im Korridor, darueber = ueber_gut, darunter = unter_min", () => {
    const { corridor } = corridorFor(2.5, 10);
    expect(classifyPriceStatus((corridor.vkMin + corridor.vkGood) / 2, corridor)).toBe("im_korridor");
    expect(classifyPriceStatus(corridor.vkGood + 2, corridor)).toBe("ueber_gut");
    expect(classifyPriceStatus(corridor.vkMin - 2, corridor)).toBe("unter_min");
  });

  it("3 % Toleranz an beiden Grenzen (x,99-Rundung)", () => {
    const { corridor } = corridorFor(2.5, 10);
    expect(classifyPriceStatus(corridor.vkMin * 0.98, corridor)).toBe("im_korridor");
    expect(classifyPriceStatus(corridor.vkMin * 0.95, corridor)).toBe("unter_min");
    expect(classifyPriceStatus(corridor.vkGood * 1.02, corridor)).toBe("im_korridor");
    expect(classifyPriceStatus(corridor.vkGood * 1.05, corridor)).toBe("ueber_gut");
  });

  it("EK 0,90 / VK 4,99: knapp unter VK-MIN (5,03 €), aber innerhalb der Toleranz -> im Korridor (frueher Dauer-Alarm 'Ziel unerreichbar')", () => {
    // (0,35 + 0,90 + 0,575 + 0,67 + 0,053 + 0,02814) / 0,512 = 5,0315
    const { corridor } = corridorFor(0.9, 4.99);
    expect(corridor.vkMin).toBeCloseTo(5.0315, 3);
    expect(classifyPriceStatus(4.99, corridor)).toBe("im_korridor");
  });

  it("unter der Deckungsbeitrags-Grenze (echter Verlust) bleibt unter_min", () => {
    const { corridor } = corridorFor(8, 6);
    expect(6).toBeLessThan(corridor.vkContribution);
    expect(classifyPriceStatus(6, corridor)).toBe("unter_min");
  });
});
