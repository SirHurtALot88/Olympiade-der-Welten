import { describe, expect, it } from "vitest";
import { buildImportPlan } from "./importPlan";
import type { BillbeeImportResult, BillbeeRow } from "../importers/billbee";
import type { EbayImportResult, EbayRow } from "../importers/ebay";
import { normalizeArticleName } from "../parsing/name";
import { extractSetCode } from "../parsing/setCode";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";
import { totalFixedYearly, registeredRateBelowThreshold } from "../pricing/costEngine";

function billbeeRow(nameRaw: string, overrides: Partial<BillbeeRow> = {}): BillbeeRow {
  const { normalized, packQty } = normalizeArticleName(nameRaw);
  return {
    sku: null,
    nameRaw,
    nameNormalized: normalized,
    packQty,
    setCode: extractSetCode(nameRaw),
    isCard: true,
    qty: 1,
    revenue: 10,
    ek: 3,
    marge: 7,
    ...overrides,
  };
}

function billbeeResult(
  window: BillbeeImportResult["window"],
  rows: BillbeeRow[]
): BillbeeImportResult {
  return {
    window,
    windowFrom: new Date("2026-01-01"),
    windowTo: new Date("2026-07-15"),
    rows,
  };
}

function ebayRow(titleRaw: string, overrides: Partial<EbayRow> = {}): EbayRow {
  const { normalized } = normalizeArticleName(titleRaw);
  return {
    titleRaw,
    titleNormalized: normalized,
    setCode: extractSetCode(titleRaw),
    isCard: true,
    ebayItemId: "1",
    shopCategoryL1: "Sonstiges",
    shopCategoryL2: null,
    qtySold: 1,
    totalRevenueGross: 10,
    revenueNetShipping: 9,
    shippingPaidByBuyer: 1,
    totalSellingCosts: 2,
    listingFees: 0,
    optionalFees: 0,
    salesCommission: 1,
    adFeesBasic: 1,
    adFeesPremium: 0,
    adFeesExpress: 0,
    adFeesExternal: 0,
    internationalFees: 0,
    otherFees: 0,
    depositFees: 0,
    feeCredits: 0,
    shippingLabelCost: 0,
    revenueAfterCosts: 8,
    avgSellingPrice: 10,
    ...overrides,
  };
}

describe("buildImportPlan", () => {
  it("baut den Artikel-Katalog dedupliziert ueber mehrere Fenster", () => {
    const name = "Yu-Gi-Oh! TST-DE001 Testkarte Ultra Rare";
    const plan = buildImportPlan(
      [
        billbeeResult("30", [billbeeRow(name, { qty: 2, revenue: 20, ek: 6, marge: 14 })]),
        billbeeResult("365", [billbeeRow(name, { qty: 8, revenue: 80, ek: 24, marge: 56 })]),
      ],
      null,
      DEFAULT_COST_SETTINGS
    );
    expect(plan.articles).toHaveLength(1);
    expect(plan.saleWindows).toHaveLength(2);
  });

  it("berechnet DB I = Umsatz - EK unabhaengig von eBay-Daten", () => {
    const plan = buildImportPlan(
      [billbeeResult("30", [billbeeRow("Yu-Gi-Oh! TST-DE002 Karte", { qty: 3, revenue: 30, ek: 9 })])],
      null,
      DEFAULT_COST_SETTINGS
    );
    expect(plan.saleWindows[0].dbI).toBeCloseTo(21);
  });

  it("verteilt die Fixkosten SHOPWEIT (ueber alle Artikel), nicht je Artikel", () => {
    // Regressionstest: eBay-Shop-/Billbee-/Lexoffice-Gebuehren sind Fixkosten
    // des GESAMTEN Shops. Wuerden sie faelschlich durch die 365d-Stueckzahl
    // NUR des einzelnen Artikels geteilt, wuerde ein Nischen-Artikel mit
    // wenigen eigenen Verkaeufen die komplette Fixkostenlast allein tragen
    // (siehe Bugfix: Umlage jetzt ueber die shopweite 365d-Gesamtstueckzahl).
    const nischenArtikel = "Yu-Gi-Oh! TST-DE777 Nischenkarte";
    const rennerArtikel = "Yu-Gi-Oh! TST-DE778 Renner";
    const plan = buildImportPlan(
      [
        billbeeResult("30", [billbeeRow(nischenArtikel, { qty: 1, revenue: 30, ek: 10 })]),
        billbeeResult("365", [
          // Shopweit insgesamt 60 verkaufte Karten/Jahr (1 Nischenartikel + 59 vom Renner).
          billbeeRow(nischenArtikel, { qty: 1, revenue: 30, ek: 10 }),
          billbeeRow(rennerArtikel, { qty: 59, revenue: 590, ek: 177 }),
        ]),
      ],
      null,
      DEFAULT_COST_SETTINGS
    );
    const sw30 = plan.saleWindows.find((s) => s.window === "30")!;
    // Alle Fixkostenfelder (4.229 EUR/Jahr) / 60 shopweite Stk * 1 verkaufte Stk im 30d-Fenster.
    expect(sw30.fixedCostShare).toBeCloseTo(totalFixedYearly(DEFAULT_COST_SETTINGS) / 60, 5);
    expect(sw30.fixedCostShare).toBeCloseTo(4229 / 60, 5);
    // NICHT 4.229 EUR (= volle Jahresfixkosten allein auf den einen Nischenverkauf umgelegt).
    expect(sw30.fixedCostShare).toBeLessThan(100);
  });

  it("rechnet das Einschreiben je Zeile nach Ø-VK (Schwelle) und N/N_T aus dem Shop-Fenster", () => {
    // Regression: vorher pauschal 0,15 je Stueck, egal ob 4,99er oder 35-EUR-Karte.
    const guenstig = "Yu-Gi-Oh! TST-DE801 Billigkarte";
    const teuer = "Yu-Gi-Oh! TST-DE802 Teurekarte";
    const plan = buildImportPlan(
      [
        billbeeResult("365", [
          billbeeRow(guenstig, { qty: 90, revenue: 90 * 4.99, ek: 90 * 0.9 }),
          billbeeRow(teuer, { qty: 10, revenue: 350, ek: 180 }),
        ]),
      ],
      null,
      DEFAULT_COST_SETTINGS
    );
    const sGuenstig = plan.saleWindows.find((s) => s.nameNormalized.includes("billigkarte"))!;
    const sTeuer = plan.saleWindows.find((s) => s.nameNormalized.includes("teurekarte"))!;
    const volume = { units365d: 100, unitsAtOrAboveThreshold: 10 };
    const r = registeredRateBelowThreshold(volume, DEFAULT_COST_SETTINGS);
    const fixedPerUnit = 4229 / 100;
    // shippingCost enthaelt NUR variable Nebenkosten -- der Fixkostenanteil wird
    // getrennt in fixedCostShare gefuehrt (DB II ist ein Deckungsbeitrag).
    const common = 0.575 + 0.67 + 0.053; // Einkaufs-Versand 50 %, Versand, Verpackung
    expect(sGuenstig.shippingCost / 90).toBeCloseTo(common + r, 5);
    expect(sTeuer.shippingCost / 10).toBeCloseTo(common + 2.35, 5);
    expect(sGuenstig.fixedCostShare / 90).toBeCloseTo(fixedPerUnit, 5);
    expect(sTeuer.fixedCostShare / 10).toBeCloseTo(fixedPerUnit, 5);
  });

  it("fuehrt DB II als Deckungsbeitrag OHNE Fixkosten, Vollkosten = dbII - fixedCostShare", () => {
    // Regression: zuvor steckte der Fixkostenanteil in shippingCost und damit in dbII.
    // Folge: dbII war in Wahrheit ein Vollkosten-Wert, und wer fixedCostShare
    // zusaetzlich abzog, zaehlte ihn doppelt.
    const name = "Yu-Gi-Oh! TST-DE803 Dreistufig";
    const plan = buildImportPlan(
      [billbeeResult("365", [billbeeRow(name, { qty: 10, revenue: 100, ek: 40 })])],
      null,
      DEFAULT_COST_SETTINGS
    );
    const sw = plan.saleWindows[0];
    expect(sw.dbI).toBeCloseTo(60, 5); // Umsatz - EK
    expect(sw.dbII).toBeCloseTo(sw.dbI - sw.ebayFeeTotal - sw.shippingCost, 5);
    expect(sw.fixedCostShare).toBeGreaterThan(0);
    // DB II liegt UEBER dem Vollkosten-Ergebnis, genau um den Fixkostenanteil.
    expect(sw.dbII - (sw.dbII - sw.fixedCostShare)).toBeCloseTo(sw.fixedCostShare, 5);
    expect(sw.dbII).toBeGreaterThan(sw.dbII - sw.fixedCostShare);
  });

  it("verteilt eBay-Gebuehren aus gematchten Zeilen auf DB II", () => {
    const name = "Yu-Gi-Oh! TST-DE003 Karte";
    const ebay: EbayImportResult = {
      reportFrom: null,
      reportTo: null,
      subscriptionFee: null,
      rows: [ebayRow(name, { qtySold: 3, totalSellingCosts: 6 })],
    };
    const plan = buildImportPlan(
      [billbeeResult("30", [billbeeRow(name, { qty: 3, revenue: 30, ek: 9 })])],
      ebay,
      DEFAULT_COST_SETTINGS
    );
    const sw = plan.saleWindows[0];
    // 6 EUR Gebuehren / 3 Stk = 2 EUR/Stk -> bei 3 verkauften Stk = 6 EUR eBay-Gebuehr total.
    expect(sw.ebayFeeTotal).toBeCloseTo(6);
    expect(sw.dbII).toBeLessThan(sw.dbI);
    expect(sw.dbII).toBeCloseTo(sw.dbI - sw.ebayFeeTotal - sw.shippingCost, 5);
  });

  it("filtert Privatverkaeufe aus den Fenster-Snapshots und der Review-Liste", () => {
    const plan = buildImportPlan(
      [
        billbeeResult("30", [
          billbeeRow("Schmuck Konvolut Testring", { isCard: false, setCode: null }),
        ]),
      ],
      null,
      DEFAULT_COST_SETTINGS
    );
    expect(plan.saleWindows).toHaveLength(0);
    expect(plan.reviewItems).toHaveLength(0);
  });

  it("legt ungematchte Kartenartikel in die Review-Liste (Billbee- und eBay-Seite)", () => {
    const ebay: EbayImportResult = {
      reportFrom: null,
      reportTo: null,
      subscriptionFee: null,
      rows: [ebayRow("Yu-Gi-Oh! ANDERS-DE999 Voellig anderer Titel")],
    };
    const plan = buildImportPlan(
      [billbeeResult("30", [billbeeRow("Yu-Gi-Oh! TST-DE004 Unmatched Karte")])],
      ebay,
      DEFAULT_COST_SETTINGS
    );
    expect(plan.reviewItems).toHaveLength(2);
    expect(plan.stats.unmatchedBillbeeArticles).toBe(1);
    expect(plan.stats.unmatchedEbayListings).toBe(1);
  });

  it("erreicht eine hohe exakte Match-Rate bei ueberwiegend identischen Namen", () => {
    const names = Array.from({ length: 20 }, (_, i) => `Yu-Gi-Oh! TST-DE${100 + i} Karte ${i}`);
    const billbeeRows = names.map((n) => billbeeRow(n));
    const ebayRows = names.map((n) => ebayRow(n));
    const plan = buildImportPlan(
      [billbeeResult("30", billbeeRows)],
      { reportFrom: null, reportTo: null, subscriptionFee: null, rows: ebayRows },
      DEFAULT_COST_SETTINGS
    );
    expect(plan.stats.exactMatchRate).toBe(1);
  });
});
